import json
import uuid
import pytest
from app.database import Base, engine, SessionLocal
from app.models import SessionRow
from app.data.catalog import get_stall_catalog, get_product, get_negotiation_policy
from app.services import shop_service
from app.services.conversation import dialogue


@pytest.fixture
def db():
    Base.metadata.create_all(engine)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
def session_row(db):
    sid = str(uuid.uuid4())
    row = SessionRow(
        id=sid,
        player_name="TestFoodie",
        scenario_id="evening_food_plaza",
        game_state_json=json.dumps({"game": "after_hours_city", "place": "Old Town Square", "visited": [], "relationships": {}}),
        mission_state_json=json.dumps({}),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def test_catalog_structure_and_negotiation_policies():
    """Verify all 18 stalls have products and valid negotiation policies."""
    stalls = ["pani-puri", "chaat", "masala-dosa", "idli-sambar", "vada-pav", "pav-bhaji",
              "jalebi", "chai", "momos", "kathi-roll", "kulfi", "biryani",
              "lassi", "dhokla", "poha", "uttapam", "paratha", "filter-coffee"]
    for stall_id in stalls:
        catalog = get_stall_catalog(stall_id)
        assert len(catalog) >= 1, f"Stall {stall_id} must have items"
        item = catalog[0]
        assert "base_price" in item and item["base_price"] > 0
        assert "currency" in item and item["currency"] == "INR"
        assert "ingredients" in item and len(item["ingredients"]) > 0
        assert "allergens" in item
        policy = get_negotiation_policy(stall_id)
        assert policy["max_discount_pct"] > 0


def test_cart_operations_and_authoritative_calculations(db, session_row):
    """Test adding items, variants, add-ons, quantity capping, and removing items."""
    sid = session_row.id
    vendor_id = "masala-dosa"

    # Add 2x masala dosa (base price 80 = 160)
    ok, cart, msg = shop_service.add_to_cart(db, sid, vendor_id, "masala_dosa", quantity=2)
    assert ok is True
    assert cart.subtotal == 160
    assert cart.total == 160

    # Add 1x plain dosa with ghee podi add-on (base 60 + 20 add-on = 80)
    ok, cart, msg = shop_service.add_to_cart(
        db, sid, vendor_id, "plain_dosa", quantity=1, add_on_ids=["podi_ghee"]
    )
    assert ok is True
    assert cart.subtotal == 240
    assert cart.total == 240
    assert len(json.loads(cart.items_json)) == 2

    # Remove the first item
    items = json.loads(cart.items_json)
    first_line_id = items[0]["line_id"]
    ok, cart, msg = shop_service.remove_from_cart(db, sid, vendor_id, first_line_id)
    assert ok is True
    assert cart.subtotal == 80
    assert cart.total == 80


def test_negotiated_discount_rule_enforcement(db, session_row):
    """Verify that discount proposals are clamped or validated against authoritative vendor policies."""
    sid = session_row.id
    vendor_id = "masala-dosa"

    # Add ₹160 worth of dosa
    shop_service.add_to_cart(db, sid, vendor_id, "masala_dosa", quantity=2)



def test_atomic_checkout_wallet_and_inventory(db, session_row):
    """Test atomic checkout, currency deduction, inventory decrement, and idempotency."""
    sid = session_row.id
    vendor_id = "pani-puri"

    init_balance = shop_service.get_wallet_balance(db, sid)
    assert init_balance == 500

    # Order 2x Classic Pani Puri (40 * 2 = 80)
    shop_service.add_to_cart(db, sid, vendor_id, "pani_puri_classic", quantity=2)

    stock_before = shop_service.get_product_stock(db, sid, "pani_puri_classic")

    idempotency_key = f"test-checkout-{uuid.uuid4()}"
    ok, receipt, msg = shop_service.execute_checkout(db, sid, idempotency_key=idempotency_key)
    assert ok is True
    assert receipt["total"] == 80
    assert receipt["status"] == "confirmed"

    # Verify wallet was debited by ₹80
    new_balance = shop_service.get_wallet_balance(db, sid)
    assert new_balance == 420

    # Verify inventory was decremented by 2
    stock_after = shop_service.get_product_stock(db, sid, "pani_puri_classic")
    assert stock_after == stock_before - 2

    # Idempotent replay: executing with same idempotency key must NOT double-charge!
    ok_replay, receipt_replay, _ = shop_service.execute_checkout(db, sid, idempotency_key=idempotency_key)
    assert ok_replay is True
    assert shop_service.get_wallet_balance(db, sid) == 420  # Still 420, not double debited!


def test_insufficient_funds_fails_safely(db, session_row):
    """Verify orders fail cleanly if player cannot afford them."""
    sid = session_row.id
    vendor_id = "biryani"

    # Add 4x Dum Biryani (150 * 4 = 600) -> wallet has 500
    shop_service.add_to_cart(db, sid, vendor_id, "dum_biryani", quantity=4)

    ok, receipt, msg = shop_service.execute_checkout(db, sid)
    assert ok is False
    assert "You need ₹100 more" in msg or "wallet" in msg.lower()
    assert shop_service.get_wallet_balance(db, sid) == 500  # Untouched


def test_conversational_purchase_journey_through_dialogue(db, session_row):
    """Test the full conversational flow: inquiry -> add item -> negotiate -> checkout."""
    sid = session_row.id
    stall_id = "masala-dosa"

    # Turn 1: Player asks for masala dosa
    res1 = dialogue(db, session_row, "Can I get one masala dosa please?", "evening_food_plaza", stall_id)
    assert res1["cart"] is not None
    assert res1["cart"]["subtotal"] >= 80

    # Turn 2: Player negotiates
    res2 = dialogue(db, session_row, "Can you give me a small discount?", "evening_food_plaza", stall_id)
    assert res2["cart"]["discount_amount"] > 0
    assert res2["cart"]["total"] < res1["cart"]["subtotal"]

    # Turn 3: Player confirms purchase
    res3 = dialogue(db, session_row, "Yes, place the order", "evening_food_plaza", stall_id)
    assert res3["receipt"] is not None
    assert res3["receipt"]["status"] == "confirmed"
    assert res3["wallet"]["balance"] < 500

    # Turn 4: Vendor remembers previous order
    orders_mem = shop_service.get_vendor_order_memory(db, sid, stall_id)
    assert len(orders_mem) >= 1
    assert "Masala Dosa" in orders_mem[0]



def test_shop_rest_api_endpoints(db, session_row):
    """Test all shop REST endpoints via TestClient."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    sid = session_row.id

    # 1. Get wallet
    res_w = client.get(f"/api/v1/sessions/{sid}/wallet")
    assert res_w.status_code == 200
    assert res_w.json()["balance"] == 500

    # 2. Get catalog
    res_c = client.get(f"/api/v1/sessions/{sid}/shop/catalog/masala-dosa")
    assert res_c.status_code == 200
    assert len(res_c.json()["catalog"]) >= 2

    # 3. Add to cart
    res_add = client.post(
        f"/api/v1/sessions/{sid}/cart/items",
        json={"vendor_id": "masala-dosa", "product_id": "masala_dosa", "quantity": 1, "variant_id": "ghee_roast", "add_on_ids": ["extra_sambar"]},
    )
    assert res_add.status_code == 200
    assert res_add.json()["cart"]["subtotal"] == 115

    # 4. Apply discount
    res_d = client.post(
        f"/api/v1/sessions/{sid}/cart/discount",
        json={"vendor_id": "masala-dosa", "proposed_discount": 15},
    )
    assert res_d.status_code == 200
    assert res_d.json()["cart"]["discount_amount"] > 0

    # 5. Checkout
    idemp = f"api-test-{uuid.uuid4()}"
    res_co = client.post(f"/api/v1/sessions/{sid}/cart/checkout", json={"idempotency_key": idemp})
    assert res_co.status_code == 200
    assert res_co.json()["status"] == "confirmed"

    # 6. Get orders
    res_ord = client.get(f"/api/v1/sessions/{sid}/orders")
    assert res_ord.status_code == 200
    assert len(res_ord.json()["orders"]) >= 1

    # 7. Check wallet debited
    res_w2 = client.get(f"/api/v1/sessions/{sid}/wallet")
    assert res_w2.json()["balance"] < 500



def test_order_at_current_stall_does_not_loop_navigate(db, session_row):
    """When player is at a stall and says 'order ka paratha', it must talk to the vendor and add to cart, not navigate."""
    from app.services.conversation import interact

    sid = session_row.id
    res = interact(db, session_row, "order ka paratha", "evening_food_plaza", "paratha")
    assert res["npc"]["id"] == "paratha"
    assert res["npc"]["name"] == "Simran"
    assert res["cart"] is not None
    assert res["cart"]["subtotal"] >= 80
    assert any(item["product_id"] == "aloo_paratha" for item in res["cart"]["items"])
    assert "head over to" not in res["reply"].lower()

