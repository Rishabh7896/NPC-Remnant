from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json

from app.database import get_db
from app.models import SessionRow
from app.schemas import AddToCartRequest, ApplyDiscountRequest, CheckoutRequest
from app.services import shop_service
from app.data.catalog import get_stall_catalog, get_negotiation_policy

router = APIRouter(prefix="/api/v1/sessions", tags=["shop"])


def _verify_session(session_id: str, db: Session) -> SessionRow:
    row = db.get(SessionRow, session_id)
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    return row


@router.get("/{session_id}/shop/catalog/{vendor_id}")
def get_catalog(session_id: str, vendor_id: str, db: Session = Depends(get_db)):
    _verify_session(session_id, db)
    items = get_stall_catalog(vendor_id)
    policy = get_negotiation_policy(vendor_id)
    # Enrich with session-specific stock
    enriched = []
    for item in items:
        stock = shop_service.get_product_stock(db, session_id, item["product_id"])
        enriched.append({**item, "stock_quantity": stock})
    return {"vendor_id": vendor_id, "catalog": enriched, "negotiation_policy": policy}


@router.get("/{session_id}/cart")
def get_cart(session_id: str, vendor_id: str = "", db: Session = Depends(get_db)):
    _verify_session(session_id, db)
    cart = shop_service.get_or_create_cart(db, session_id, vendor_id or "masala-dosa")
    return {
        "cart_id": cart.id,
        "vendor_id": cart.vendor_id,
        "state": cart.state,
        "items": json.loads(cart.items_json),
        "subtotal": cart.subtotal,
        "discount_amount": cart.discount_amount,
        "discount_reason": cart.discount_reason,
        "total": cart.total,
        "updated_at": cart.updated_at.isoformat() if cart.updated_at else None,
    }


@router.post("/{session_id}/cart/items")
def add_item_to_cart(session_id: str, body: AddToCartRequest, db: Session = Depends(get_db)):
    _verify_session(session_id, db)
    ok, cart, msg = shop_service.add_to_cart(
        db,
        session_id=session_id,
        vendor_id=body.vendor_id,
        product_id=body.product_id,
        quantity=body.quantity,
        variant_id=body.variant_id or None,
        add_on_ids=body.add_on_ids,
        notes=body.notes,
    )
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return {
        "status": "success",
        "message": msg,
        "cart": {
            "cart_id": cart.id,
            "vendor_id": cart.vendor_id,
            "items": json.loads(cart.items_json),
            "subtotal": cart.subtotal,
            "discount_amount": cart.discount_amount,
            "total": cart.total,
        },
    }


@router.delete("/{session_id}/cart/items/{item_id}")
def remove_item_from_cart(session_id: str, item_id: str, vendor_id: str = "", db: Session = Depends(get_db)):
    _verify_session(session_id, db)
    ok, cart, msg = shop_service.remove_from_cart(
        db, session_id=session_id, vendor_id=vendor_id, product_or_line_id=item_id
    )
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return {
        "status": "success",
        "message": msg,
        "cart": {
            "cart_id": cart.id,
            "vendor_id": cart.vendor_id,
            "items": json.loads(cart.items_json),
            "subtotal": cart.subtotal,
            "discount_amount": cart.discount_amount,
            "total": cart.total,
        },
    }


@router.post("/{session_id}/cart/clear")
def clear_active_cart(session_id: str, db: Session = Depends(get_db)):
    _verify_session(session_id, db)
    cart = shop_service.clear_cart(db, session_id)
    return {"status": "cleared", "cart_id": cart.id if cart else None}


@router.post("/{session_id}/cart/discount")
def apply_discount(session_id: str, body: ApplyDiscountRequest, db: Session = Depends(get_db)):
    _verify_session(session_id, db)
    ok, cart, approved, msg = shop_service.apply_negotiated_discount(
        db,
        session_id=session_id,
        vendor_id=body.vendor_id,
        proposed_discount_rupees=body.proposed_discount,
        reason=body.reason,
    )
    return {
        "applied": ok,
        "approved_discount": approved,
        "message": msg,
        "cart": {
            "cart_id": cart.id,
            "subtotal": cart.subtotal,
            "discount_amount": cart.discount_amount,
            "total": cart.total,
        },
    }


@router.post("/{session_id}/cart/checkout")
def checkout_cart(session_id: str, body: CheckoutRequest, db: Session = Depends(get_db)):
    _verify_session(session_id, db)
    ok, receipt, msg = shop_service.execute_checkout(
        db, session_id=session_id, idempotency_key=body.idempotency_key or None
    )
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "confirmed", "receipt": receipt, "message": msg}


@router.get("/{session_id}/orders")
def get_orders(session_id: str, vendor_id: str = "", db: Session = Depends(get_db)):
    _verify_session(session_id, db)
    orders = shop_service.get_order_history(db, session_id, vendor_id or None)
    return {"orders": orders}


@router.get("/{session_id}/wallet")
def get_wallet(session_id: str, db: Session = Depends(get_db)):
    _verify_session(session_id, db)
    balance = shop_service.get_wallet_balance(db, session_id)
    return {"currency": "INR", "balance": balance, "symbol": "₹"}
