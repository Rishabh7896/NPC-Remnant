"""Authoritative shopping service for Echoes After Hours conversational commerce.

Handles carts, authoritative pricing, stock validation, dynamic discount rules,
atomic purchase transactions, receipts, and order memory.
"""
from __future__ import annotations
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models import CartRow, OrderRow, WalletTransactionRow, InventoryStockRow
from app.data.catalog import (
    CATALOG_ITEMS,
    PRODUCTS_BY_ID,
    PRODUCTS_BY_VENDOR,
    get_product,
    get_stall_catalog,
    get_negotiation_policy,
)
from app.stalls import STALL_BY_ID

INITIAL_WALLET_FUNDS = 500  # Starting in-game rupees (₹)


def now_utc():
    return datetime.now(timezone.utc)


def get_wallet_balance(db: Session, session_id: str) -> int:
    """Return player's authoritative wallet balance from transaction ledger, granting initial funds if fresh."""
    total = db.scalar(
        select(func.sum(WalletTransactionRow.amount))
        .where(WalletTransactionRow.session_id == session_id)
    )
    if total is None:
        init_tx = WalletTransactionRow(
            id=str(uuid.uuid4()),
            session_id=session_id,
            amount=INITIAL_WALLET_FUNDS,
            balance_after=INITIAL_WALLET_FUNDS,
            reason="initial_funds",
            reference_id=None,
            created_at=now_utc(),
        )
        db.add(init_tx)
        db.commit()
        return INITIAL_WALLET_FUNDS
    return int(total)


def get_product_stock(db: Session, session_id: str, product_id: str) -> int:
    """Get authoritative stock quantity for a product in this session."""
    row = db.scalars(
        select(InventoryStockRow)
        .where(InventoryStockRow.session_id == session_id, InventoryStockRow.product_id == product_id)
    ).first()
    if row is not None:
        return row.stock_quantity
    product = get_product(product_id)
    return product.get("stock_quantity", 40) if product else 0


def get_or_create_cart(db: Session, session_id: str, vendor_id: str) -> CartRow:
    """Retrieve existing active draft cart or initialize a fresh one for the vendor."""
    cart = db.scalars(
        select(CartRow)
        .where(CartRow.session_id == session_id, CartRow.state.in_(["building_cart", "awaiting_confirmation"]))
        .order_by(CartRow.created_at.desc())
    ).first()

    if cart is None:
        cart = CartRow(
            id=str(uuid.uuid4()),
            session_id=session_id,
            vendor_id=vendor_id,
            state="building_cart",
            items_json="[]",
            subtotal=0,
            discount_amount=0,
            discount_reason="",
            total=0,
            created_at=now_utc(),
            updated_at=now_utc(),
        )
        db.add(cart)
        db.commit()
        return cart

    # If player moved to a different stall, switch or update the cart vendor context
    if cart.vendor_id != vendor_id:
        cart.vendor_id = vendor_id
        cart.updated_at = now_utc()
        db.commit()
    return cart


def _recalculate_cart_totals(cart: CartRow, items: list[dict], vendor_id: str) -> None:
    """Recalculate subtotal, validate any applied discount, and update final total."""
    subtotal = sum(item.get("line_total", 0) for item in items)
    cart.items_json = json.dumps(items)
    cart.subtotal = subtotal

    # Validate existing discount against new subtotal and vendor policy
    policy = get_negotiation_policy(vendor_id)
    max_discount = int(subtotal * (policy["max_discount_pct"] / 100.0))
    if cart.discount_amount > max_discount:
        cart.discount_amount = max_discount

    cart.total = max(0, subtotal - cart.discount_amount)
    cart.updated_at = now_utc()


def add_to_cart(
    db: Session,
    session_id: str,
    vendor_id: str,
    product_id: str,
    quantity: int = 1,
    variant_id: Optional[str] = None,
    add_on_ids: Optional[list[str]] = None,
    notes: str = "",
) -> tuple[bool, CartRow, str]:
    """Authoritatively add an item to the draft cart after checking availability and options."""
    product = get_product(product_id)
    if not product:
        return False, get_or_create_cart(db, session_id, vendor_id), f"Product '{product_id}' is not in the catalog."

    if product["vendor_id"] != vendor_id:
        return False, get_or_create_cart(db, session_id, vendor_id), f"{product['name']} is sold at another stall."

    if not product.get("available", True):
        return False, get_or_create_cart(db, session_id, vendor_id), f"{product['name']} is currently sold out."

    quantity = max(1, min(quantity, product.get("max_quantity_per_order", 6)))
    current_stock = get_product_stock(db, session_id, product_id)
    if current_stock < quantity:
        return False, get_or_create_cart(db, session_id, vendor_id), f"Only {current_stock} portions of {product['name']} remaining."

    # Resolve variant
    variant_data = None
    variant_price_delta = 0
    if variant_id:
        for v in product.get("variants", []):
            if v["id"] == variant_id:
                variant_data = v
                variant_price_delta = v.get("price_delta", 0)
                break

    # Resolve add-ons
    valid_add_ons = []
    add_ons_price = 0
    if add_on_ids:
        catalog_add_ons = {a["id"]: a for a in product.get("add_ons", [])}
        for aid in add_on_ids:
            if aid in catalog_add_ons:
                ao = catalog_add_ons[aid]
                valid_add_ons.append(ao)
                add_ons_price += ao.get("price", 0)

    unit_price = product["base_price"] + variant_price_delta + add_ons_price
    line_total = unit_price * quantity

    cart = get_or_create_cart(db, session_id, vendor_id)
    items = json.loads(cart.items_json)

    # Check if identical configuration already exists
    matched = False
    for existing in items:
        if (
            existing["product_id"] == product_id
            and (existing.get("variant") or {}).get("id") == variant_id
            and sorted([a["id"] for a in existing.get("add_ons", [])]) == sorted([a["id"] for a in valid_add_ons])
        ):
            new_qty = min(existing["quantity"] + quantity, product.get("max_quantity_per_order", 6))
            existing["quantity"] = new_qty
            existing["line_total"] = existing["unit_price"] * new_qty
            matched = True
            break

    if not matched:
        items.append({
            "line_id": str(uuid.uuid4())[:8],
            "product_id": product_id,
            "name": product["name"],
            "unit_price": unit_price,
            "quantity": quantity,
            "variant": variant_data,
            "add_ons": valid_add_ons,
            "notes": notes,
            "line_total": line_total,
        })

    _recalculate_cart_totals(cart, items, vendor_id)
    cart.state = "building_cart"
    db.commit()
    db.refresh(cart)
    return True, cart, f"Added {quantity}x {product['name']} (₹{line_total}) to your order."



def remove_from_cart(
    db: Session,
    session_id: str,
    vendor_id: str,
    product_or_line_id: str,
) -> tuple[bool, CartRow, str]:
    """Remove an item from the draft cart by line_id or product_id."""
    cart = get_or_create_cart(db, session_id, vendor_id)
    items = json.loads(cart.items_json)
    initial_count = len(items)

    items = [
        item for item in items
        if item.get("line_id") != product_or_line_id and item.get("product_id") != product_or_line_id
    ]

    if len(items) == initial_count:
        return False, cart, f"Item '{product_or_line_id}' was not found in your cart."

    _recalculate_cart_totals(cart, items, vendor_id)
    db.commit()
    db.refresh(cart)
    return True, cart, "Item removed from your cart."


def clear_cart(db: Session, session_id: str) -> CartRow:
    """Clear all draft items from active cart."""
    cart = db.scalars(
        select(CartRow)
        .where(CartRow.session_id == session_id, CartRow.state.in_(["building_cart", "awaiting_confirmation"]))
    ).first()
    if cart:
        cart.items_json = "[]"
        cart.subtotal = 0
        cart.discount_amount = 0
        cart.discount_reason = ""
        cart.total = 0
        cart.state = "cancelled"
        cart.updated_at = now_utc()
        db.commit()
        db.refresh(cart)
    return cart


def apply_negotiated_discount(
    db: Session,
    session_id: str,
    vendor_id: str,
    proposed_discount_rupees: int,
    reason: str = "friendly_bargaining",
) -> tuple[bool, CartRow, int, str]:
    """Validate and apply a conversational discount within the vendor's policy limits."""
    cart = get_or_create_cart(db, session_id, vendor_id)
    if cart.subtotal <= 0:
        return False, cart, 0, "Your cart is empty. Add something before negotiating!"

    policy = get_negotiation_policy(vendor_id)
    if cart.subtotal < policy.get("min_cart_total", 40):
        return False, cart, 0, f"The total must be at least ₹{policy['min_cart_total']} before a discount can be offered."

    max_discount = int(cart.subtotal * (policy["max_discount_pct"] / 100.0))
    if max_discount <= 0:
        return False, cart, 0, "No discounts are currently eligible for this order."

    # Clamp proposed discount to authoritative limit
    approved_discount = min(max(0, proposed_discount_rupees), max_discount)
    if approved_discount == 0:
        approved_discount = min(10, max_discount)  # friendly round down

    items = json.loads(cart.items_json)
    cart.discount_amount = approved_discount
    cart.discount_reason = reason
    cart.total = max(0, cart.subtotal - approved_discount)
    cart.updated_at = now_utc()
    db.commit()
    db.refresh(cart)
    return True, cart, approved_discount, f"Approved a ₹{approved_discount} discount! New total is ₹{cart.total}."



def execute_checkout(
    db: Session,
    session_id: str,
    idempotency_key: Optional[str] = None,
) -> tuple[bool, Optional[dict], str]:
    """Atomically commit order, deduct player currency, decrement inventory, and generate receipt."""
    if not idempotency_key:
        idempotency_key = str(uuid.uuid4())

    # Check for duplicate idempotency
    existing_order = db.scalars(
        select(OrderRow).where(OrderRow.idempotency_key == idempotency_key)
    ).first()
    if existing_order:
        return True, {
            "order_id": existing_order.id,
            "vendor_id": existing_order.vendor_id,
            "vendor_name": existing_order.vendor_name,
            "items": json.loads(existing_order.items_json),
            "subtotal": existing_order.subtotal,
            "discount": existing_order.discount_applied,
            "total": existing_order.total_amount,
            "status": existing_order.status,
            "created_at": existing_order.created_at.isoformat(),
            "idempotent_replay": True,
        }, "Order was already completed successfully."

    # Retrieve active cart
    cart = db.scalars(
        select(CartRow)
        .where(CartRow.session_id == session_id, CartRow.state.in_(["building_cart", "awaiting_confirmation"]))
    ).first()

    if not cart or cart.total <= 0:
        return False, None, "Your cart is empty. Add items before checking out."

    items = json.loads(cart.items_json)
    if not items:
        return False, None, "No items in the order."

    # 1. Authoritative stock check
    for line in items:
        pid = line["product_id"]
        qty = line["quantity"]
        stock = get_product_stock(db, session_id, pid)
        if stock < qty:
            return False, None, f"Insufficient stock for {line['name']}: only {stock} left."

    # 2. Authoritative wallet check
    balance = get_wallet_balance(db, session_id)
    if balance < cart.total:
        diff = cart.total - balance
        return False, None, f"You need ₹{diff} more. Your wallet has ₹{balance}, order is ₹{cart.total}."

    # 3. ATOMIC COMMIT: Deduct wallet, decrement inventory, create order, update cart
    try:
        new_balance = balance - cart.total
        wallet_tx = WalletTransactionRow(
            id=str(uuid.uuid4()),
            session_id=session_id,
            amount=-cart.total,
            balance_after=new_balance,
            reason="order_payment",
            reference_id=idempotency_key,
            created_at=now_utc(),
        )
        db.add(wallet_tx)

        # Decrement stock
        for line in items:
            pid = line["product_id"]
            qty = line["quantity"]
            stock_row = db.scalars(
                select(InventoryStockRow)
                .where(InventoryStockRow.session_id == session_id, InventoryStockRow.product_id == pid)
            ).first()
            if stock_row:
                stock_row.stock_quantity = max(0, stock_row.stock_quantity - qty)
                stock_row.updated_at = now_utc()
            else:
                product = get_product(pid)
                init_stock = product.get("stock_quantity", 40) if product else 40
                stock_row = InventoryStockRow(
                    id=f"{session_id}:{pid}",
                    session_id=session_id,
                    product_id=pid,
                    vendor_id=cart.vendor_id,
                    stock_quantity=max(0, init_stock - qty),
                    updated_at=now_utc(),
                )
                db.add(stock_row)

        stall_info = STALL_BY_ID.get(cart.vendor_id, {"vendor": "Local Vendor", "food": "Street Food"})
        order_id = f"ORD-{cart.vendor_id[:4].upper()}-{str(uuid.uuid4())[:6].upper()}"

        order = OrderRow(
            id=order_id,
            session_id=session_id,
            vendor_id=cart.vendor_id,
            vendor_name=stall_info["vendor"],
            items_json=json.dumps(items),
            subtotal=cart.subtotal,
            discount_applied=cart.discount_amount,
            total_amount=cart.total,
            status="confirmed",
            idempotency_key=idempotency_key,
            created_at=now_utc(),
        )
        db.add(order)

        # Mark cart confirmed
        cart.state = "confirmed"
        cart.updated_at = now_utc()

        db.commit()

        receipt = {
            "order_id": order_id,
            "vendor_id": cart.vendor_id,
            "vendor_name": stall_info["vendor"],
            "items": items,
            "subtotal": cart.subtotal,
            "discount": cart.discount_amount,
            "total": cart.total,
            "status": "confirmed",
            "balance_remaining": new_balance,
            "created_at": order.created_at.isoformat(),
        }
        return True, receipt, f"Order placed! Paid ₹{cart.total}. Order #{order_id}."
    except Exception as e:
        db.rollback()
        return False, None, f"Transaction error: {str(e)}"



def get_order_history(db: Session, session_id: str, vendor_id: Optional[str] = None) -> list[dict]:
    """Retrieve persistent order history for this session."""
    query = select(OrderRow).where(OrderRow.session_id == session_id)
    if vendor_id:
        query = query.where(OrderRow.vendor_id == vendor_id)
    orders = db.scalars(query.order_by(OrderRow.created_at.desc())).all()

    results = []
    for o in orders:
        results.append({
            "order_id": o.id,
            "vendor_id": o.vendor_id,
            "vendor_name": o.vendor_name,
            "items": json.loads(o.items_json),
            "subtotal": o.subtotal,
            "discount": o.discount_applied,
            "total": o.total_amount,
            "status": o.status,
            "created_at": o.created_at.isoformat(),
        })
    return results


def get_vendor_order_memory(db: Session, session_id: str, vendor_id: str) -> list[str]:
    """Return concise memory summaries of past purchases at this stall for LLM context injection."""
    orders = get_order_history(db, session_id, vendor_id)
    memories = []
    for order in orders[:3]:
        item_names = [f"{item['quantity']}x {item['name']}" for item in order.get("items", [])]
        summary = f"Player previously bought: {', '.join(item_names)} (₹{order['total']})"
        memories.append(summary)
    return memories

