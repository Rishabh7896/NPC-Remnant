"""Authoritative product catalog and pricing rules for all 18 food plaza stalls.

Prices are represented in integer INR (₹) to prevent binary floating-point errors.
All transactions must validate against this catalog.
"""
from __future__ import annotations
from typing import Optional


def _item(
    product_id: str,
    vendor_id: str,
    name: str,
    description: str,
    category: str,
    base_price: int,
    variants: list[tuple[str, str, int]],
    add_ons: list[tuple[str, str, int]],
    ingredients: list[str],
    allergens: list[str],
    min_price: Optional[int] = None,
    stock: int = 40,
) -> dict:
    return {
        "product_id": product_id,
        "vendor_id": vendor_id,
        "name": name,
        "description": description,
        "category": category,
        "base_price": base_price,
        "currency": "INR",
        "available": True,
        "stock_quantity": stock,
        "variants": [{"id": v[0], "name": v[1], "price_delta": v[2]} for v in variants],
        "add_ons": [{"id": a[0], "name": a[1], "price": a[2]} for a in add_ons],
        "ingredients": ingredients,
        "allergens": allergens,
        "preparation_time": "2-4 mins",
        "max_quantity_per_order": 6,
        "discount_eligibility": True,
        "min_price": min_price or int(base_price * 0.85),
        "max_discount_pct": 15,
        "version": 1,
    }


CATALOG_ITEMS = [
    # 1. Rani's Pani Puri
    _item("pani_puri_classic", "pani-puri", "Classic Pani Puri",
          "6 crisp puris filled with spiced potato-chickpea mash, served with chilled mint water and sweet tamarind water.",
          "Street Snacks", 40,
          [("teekha", "Extra Spicy (Teekha)", 0), ("meetha", "Sweet & Tangy", 0), ("medium", "Balanced", 0)],
          [("extra_puri", "Extra 2 Puris", 15), ("extra_boondi", "Crispy Boondi", 10)],
          ["semolina puri", "potato", "black chickpea", "mint", "tamarind", "green chili", "chaat masala"], ["gluten"], 35, 40),
    _item("dahi_puri", "pani-puri", "Dahi Puri",
          "6 puffed puris filled with potatoes and sweetened creamy yogurt, topped with sev and pomegranate.",
          "Street Snacks", 60,
          [("regular", "Regular", 0), ("extra_dahi", "Extra Sweet Dahi", 0)],
          [("extra_sev", "Extra Sev", 10), ("pomegranate", "Fresh Pomegranate", 15)],
          ["puri", "sweetened yogurt", "boiled potato", "tamarind chutney", "mint chutney", "sev"], ["gluten", "dairy"], 50, 30),

    # 2. Iqbal's Aloo Tikki Chaat
    _item("aloo_tikki_chaat", "chaat", "Aloo Tikki Chaat",
          "Two golden spiced potato croquettes crisped on the tawa, served with Punjabi chole and sonth chutney.",
          "Chaat", 60,
          [("crispy", "Extra Crispy", 0), ("soft", "Soft Center", 0)],
          [("extra_chole", "Extra Chole", 20), ("extra_dahi", "Extra Curd", 15)],
          ["potato", "green peas", "chickpeas", "ginger", "curd", "tamarind chutney"], ["dairy"], 50, 35),

    # 3. Lakshmi's Masala Dosa
    _item("masala_dosa", "masala-dosa", "Mysuru Masala Dosa",
          "Crisp golden rice-lentil crepe smeared with red garlic chutney and folded around turmeric potato bhaji.",
          "South Indian", 80,
          [("regular", "Classic Crisp", 0), ("ghee_roast", "Ghee Roast", 20), ("less_spicy", "Mild Potato", 0)],
          [("extra_sambar", "Hot Sambar Bowl", 15), ("chutney_trio", "Extra Chutney Trio", 15), ("cheese", "Grated Amul Cheese", 25)],
          ["rice", "urad dal", "potato", "onion", "mustard seeds", "curry leaves", "red chili paste"], ["dairy"], 70, 50),
    _item("plain_dosa", "masala-dosa", "Plain Butter Dosa",
          "Paper-crisp crepe brushed with pure butter, served with steaming sambar and coconut chutney.",
          "South Indian", 60,
          [("butter", "Butter Brushed", 0), ("dry", "Dry Paper Roast", 0)],
          [("extra_sambar", "Hot Sambar Bowl", 15), ("podi_ghee", "Gunpowder (Podi) & Ghee", 20)],
          ["rice", "urad dal", "butter", "coconut", "lentils"], ["dairy"], 50, 40),

    # 4. Meena's Idli & Sambar
    _item("steamed_idli", "idli-sambar", "Steamed Idli Trio",
          "Three cloud-soft steamed fermented rice cakes served with aromatic drumstick sambar and coconut chutney.",
          "South Indian", 50,
          [("regular", "Standard Trio (3 pcs)", 0), ("ghee_dip", "Sambar Dip with Ghee", 15)],
          [("extra_vada", "Add 1 Crispy Medu Vada", 25), ("podi_dip", "Milagai Podi Dip", 15)],
          ["parboiled rice", "urad dal", "fenugreek", "shallots", "drumstick", "tamarind"], ["none"], 40, 45),

    # 5. Arjun's Vada Pav
    _item("vada_pav_classic", "vada-pav", "Mumbai Vada Pav",
          "Spiced potato vada inside soft buttered pav with fiery dry garlic chutney and salted green chili.",
          "Mumbai Street Food", 35,
          [("regular", "Original Mumbai Style", 0), ("cheese", "Cheese Vada Pav", 20), ("garlic_heavy", "Extra Dry Garlic", 0)],
          [("fried_chili", "Salted Fried Chilies", 5), ("chura", "Crispy Besan Chura", 5)],
          ["potato", "gram flour (besan)", "pav bread", "garlic", "peanuts", "mustard seeds", "green chili"], ["gluten", "peanuts"], 30, 60),
    # 6. Farida's Pav Bhaji
    _item("butter_pav_bhaji", "pav-bhaji", "Amul Butter Pav Bhaji",
          "Spiced mashed vegetables sizzling on the tawa in Amul butter, served with two toasted pavs and lemon.",
          "Mumbai Street Food", 100,
          [("classic", "Butter Loaded", 0), ("cheese", "Cheese Pav Bhaji", 25), ("jain", "Jain (No Onion/Garlic)", 0)],
          [("extra_pav", "Pair of Toasted Butter Pavs", 25), ("butter_slab", "Extra Amul Butter Slab", 15)],
          ["potatoes", "cauliflower", "green peas", "tomatoes", "capsicum", "pav bhaji masala", "butter", "pav"], ["dairy", "gluten"], 85, 40),

    # 7. Kavita's Jalebi & Imarti
    _item("desi_ghee_jalebi", "jalebi", "Desi Ghee Jalebi (200g)",
          "Hot, crispy coils fried in pure desi ghee and soaked in saffron-cardamom sugar syrup.",
          "Mithai", 60,
          [("crisp", "Hot & Crisp", 0), ("juicy", "Juicy & Soft", 0)],
          [("rabdi_cup", "Thick Malai Rabdi Cup", 30)],
          ["all-purpose flour", "desi ghee", "saffron", "cardamom", "sugar"], ["gluten", "dairy"], 50, 30),

    # 8. Babu's Cutting Chai
    _item("cutting_chai", "chai", "Ginger Cutting Chai",
          "Strong Indian milk tea brewed with crushed adrak and green cardamom, poured high into glasses.",
          "Beverages", 20,
          [("adrak", "Ginger (Adrak) Heavy", 0), ("elaichi", "Cardamom Heavy", 0), ("less_sweet", "Less Sweet", 0)],
          [("bun_maska", "Buttered Bun Maska", 25), ("biscuits", "Pair of Tea Biscuits", 10)],
          ["black tea leaves", "milk", "crushed ginger", "cardamom", "sugar"], ["dairy"], 15, 80),

    # 9. Tenzin's Momos
    _item("steamed_momos", "momos", "Himalayan Steamed Momos (8 pcs)",
          "Handmade dumplings stuffed with seasoned farm vegetables, served with spicy red chili-garlic chutney.",
          "Himalayan Street Food", 80,
          [("veg", "Farm Vegetable", 0), ("paneer", "Cottage Cheese & Herb", 15), ("fried", "Pan Fried", 10)],
          [("extra_dip", "Extra Red Garlic Dip", 10), ("soup", "Thukpa Veg Broth", 20)],
          ["wheat flour", "cabbage", "carrots", "onion", "ginger", "garlic", "chili"], ["gluten", "sesame"], 70, 35),

    # 10. Sana's Kathi Roll
    _item("paneer_kathi_roll", "kathi-roll", "Kolkata Paneer Tikka Roll",
          "Smoky charred paneer wrapped in flaky paratha with sliced red onions and fresh mint chutney.",
          "Rolls & Wraps", 90,
          [("paneer", "Paneer Tikka", 0), ("egg_wrap", "Egg Layered Paratha", 10)],
          [("extra_cheese", "Melted Cheese Lining", 20), ("double_filling", "Double Paneer Portion", 30)],
          ["wheat flour", "paneer", "capsicum", "onion", "yogurt", "mint"], ["gluten", "dairy"], 80, 30),

    # 11. Harish's Kulfi
    _item("malai_kulfi", "kulfi", "Old Delhi Malai Kulfi",
          "Slow-caramelized dense milk kulfi on a stick, infused with cardamom and slivered pistachios.",
          "Desserts", 60,
          [("malai", "Classic Malai", 0), ("pista", "Royal Pistachio", 10), ("kesar", "Saffron Cardamom", 10)],
          [("falooda", "Rose Falooda & Sabja", 25)],
          ["whole milk", "sugar", "cardamom", "pistachio", "almond"], ["dairy", "tree nuts"], 50, 40),

    # 12. Zoya's Dum Biryani
    _item("dum_biryani", "biryani", "Hyderabadi Dum Veg Biryani",
          "Aged basmati rice slow-cooked in a sealed handi with whole spices, saffron milk, and fried onions.",
          "Rice & Biryani", 150,
          [("veg_dum", "Vegetable Dum", 0), ("paneer_dum", "Paneer Dum Special", 20)],
          [("salan", "Mirchi Ka Salan Bowl", 20), ("raita", "Cold Boondi Raita", 15)],
          ["basmati rice", "vegetables", "fried onion", "saffron", "whole spices"], ["dairy"], 130, 30),

    # 13. Gurpreet's Lassi
    _item("patiala_lassi", "lassi", "Patiala Sweet Lassi",
          "Thick churned yogurt served in a chilled earthen kulhad, crowned with fresh clotted malai.",
          "Beverages", 55,
          [("sweet", "Sweet with Malai", 0), ("mango", "Alphonso Mango", 15), ("salted_jeera", "Roasted Cumin Salted", -10)],
          [("nuts_topping", "Crushed Almond & Pista", 15)],
          ["churned yogurt", "sugar", "rose water", "malai", "cardamom"], ["dairy", "tree nuts"], 45, 50),

    # 14. Hetal's Dhokla
    _item("khaman_dhokla", "dhokla", "Khaman Dhokla Plate",
          "Spongy steamed gram flour cakes tempered with crackling mustard seeds and green chilies.",
          "Gujarati Snacks", 50,
          [("regular", "Standard Tempering", 0), ("spicy", "Extra Green Chili Toss", 0)],
          [("khandvi", "Add 2 Khandvi Rolls", 20)],
          ["gram flour (besan)", "mustard seeds", "green chili", "coriander", "lemon"], ["none"], 40, 40),

    # 15. Ramesh's Indori Poha
    _item("indori_poha", "poha", "Indori Steamed Poha",
          "Steamed turmeric flattened rice topped with crunchy Ratlami sev, diced onions, and Jeeravan masala.",
          "Breakfast & Snacks", 45,
          [("classic", "Ratlami Sev Topping", 0), ("usal_tari", "Spiced Usal Gravy Dip", 15)],
          [("pomegranate", "Fresh Pomegranate", 10), ("jalebi_side", "Two Hot Jalebis", 20)],
          ["flattened rice", "fennel", "onion", "mustard seeds", "lemon", "sev"], ["none"], 35, 40),

    # 16. Anand's Uttapam
    _item("onion_uttapam", "uttapam", "Onion Tomato Uttapam",
          "Thick fermented rice-lentil pancake crisped on edges, loaded with caramelized onions and tomatoes.",
          "South Indian", 85,
          [("onion_tomato", "Onion & Tomato", 0), ("mixed_veg", "Garden Vegetables", 10), ("ghee_podi", "Ghee & Podi Roast", 20)],
          [("extra_chutney", "Extra Coconut Chutney", 10)],
          ["rice", "urad dal", "onion", "tomato", "curry leaves"], ["none"], 70, 30),

    # 17. Simran's Stuffed Paratha
    _item("aloo_paratha", "paratha", "Amritsari Aloo Paratha",
          "Whole wheat griddled flatbread stuffed with spiced potato filling, served with white butter and pickle.",
          "North Indian", 80,
          [("aloo", "Spiced Potato (Aloo)", 0), ("paneer", "Paneer Stuffed", 20), ("gobi", "Cauliflower (Gobi)", 10)],
          [("white_butter", "Extra White Makhan", 15), ("curd_bowl", "Whipped Curd Bowl", 20)],
          ["whole wheat flour", "potatoes", "ajwain", "butter", "pickle"], ["gluten", "dairy"], 70, 35),

    # 18. Karthik's Filter Coffee
    _item("filter_coffee", "filter-coffee", "Degree Filter Coffee",
          "Authentic South Indian chicory-blend filter coffee frothed with boiled whole milk in a brass tumbler.",
          "Beverages", 40,
          [("regular", "Balanced Classic", 0), ("kadak", "Strong Kadak Decoction", 0), ("less_sugar", "Less Sweet", 0)],
          [("biscuits", "Pair of Butter Biscuits", 15)],
          ["coffee beans", "chicory", "whole milk", "sugar"], ["dairy"], 30, 70),

]


PRODUCTS_BY_ID = {item["product_id"]: item for item in CATALOG_ITEMS}
PRODUCTS_BY_VENDOR: dict[str, list[dict]] = {}
for item in CATALOG_ITEMS:
    PRODUCTS_BY_VENDOR.setdefault(item["vendor_id"], []).append(item)

VENDOR_NEGOTIATION_POLICIES = {
    "pani-puri": {"max_discount_pct": 15, "min_cart_total": 40, "policy_note": "Rani is quick-witted. Offers ₹5 to ₹10 off on orders over ₹70 or repeat visits."},
    "chaat": {"max_discount_pct": 15, "min_cart_total": 60, "policy_note": "Iqbal gives ₹5 off if you compliment his chole or order multiple dishes."},
    "masala-dosa": {"max_discount_pct": 15, "min_cart_total": 80, "policy_note": "Lakshmi offers ₹10 off for hungry visitors or combo orders."},
    "idli-sambar": {"max_discount_pct": 20, "min_cart_total": 50, "policy_note": "Meena shaves ₹5 or ₹10 off for polite visitors."},
    "vada-pav": {"max_discount_pct": 15, "min_cart_total": 35, "policy_note": "Arjun gives ₹5 off on 2 vada pavs with a cheerful laugh."},
    "pav-bhaji": {"max_discount_pct": 15, "min_cart_total": 100, "policy_note": "Farida approves ₹10 to ₹15 discounts on full orders without fuss."},
    "jalebi": {"max_discount_pct": 15, "min_cart_total": 60, "policy_note": "Kavita rounds down the bill by ₹5 or ₹10 to sweeten the evening."},
    "chai": {"max_discount_pct": 25, "min_cart_total": 20, "policy_note": "Babu drops ₹5 on cutting chai if you chat with him."},
    "momos": {"max_discount_pct": 15, "min_cart_total": 80, "policy_note": "Tenzin offers ₹10 off for respectful visitors or combo orders."},
    "kathi-roll": {"max_discount_pct": 15, "min_cart_total": 80, "policy_note": "Sana discounts ₹10 on rolls for regulars or quick orders."},
    "kulfi": {"max_discount_pct": 15, "min_cart_total": 60, "policy_note": "Harish gives ₹5 to ₹10 discounts while sharing old city stories."},
    "biryani": {"max_discount_pct": 15, "min_cart_total": 150, "policy_note": "Zoya approves up to ₹20 off for guests trying her dum biryani."},
    "lassi": {"max_discount_pct": 20, "min_cart_total": 50, "policy_note": "Gurpreet knocks ₹5 or ₹10 off any kulhad order."},
    "dhokla": {"max_discount_pct": 20, "min_cart_total": 50, "policy_note": "Hetal happily rounds down prices by ₹5 or ₹10."},
    "poha": {"max_discount_pct": 20, "min_cart_total": 45, "policy_note": "Ramesh gives ₹5 off on poha combos."},
    "uttapam": {"max_discount_pct": 15, "min_cart_total": 80, "policy_note": "Anand gives ₹10 off when you appreciate good tiffin."},
    "paratha": {"max_discount_pct": 15, "min_cart_total": 80, "policy_note": "Simran allows ₹10 off and offers extra butter to ensure you leave satisfied."},
    "filter-coffee": {"max_discount_pct": 25, "min_cart_total": 40, "policy_note": "Karthik discounts ₹5 to ₹10 on a degree coffee for thoughtful chat."},
}


def get_stall_catalog(vendor_id: str) -> list[dict]:
    """Return all products sold by a specific stall."""
    return PRODUCTS_BY_VENDOR.get(vendor_id, [])


def get_product(product_id: str) -> Optional[dict]:
    """Retrieve product details by product ID."""
    return PRODUCTS_BY_ID.get(product_id)


def get_negotiation_policy(vendor_id: str) -> dict:
    """Retrieve discount rules and negotiation policy for a vendor."""
    return VENDOR_NEGOTIATION_POLICIES.get(
        vendor_id,
        {"max_discount_pct": 10, "min_cart_total": 50, "policy_note": "Standard stall discount policy."}
    )


def find_products_by_keyword(query: str, vendor_id: Optional[str] = None) -> list[dict]:
    """Fuzzy product search by keywords against names, descriptions, or ingredients."""
    q = query.casefold().strip()
    candidates = CATALOG_ITEMS if not vendor_id else PRODUCTS_BY_VENDOR.get(vendor_id, [])
    scored_matches = []
    for item in candidates:
        name = item["name"].casefold()
        pid = item["product_id"].replace("_", " ")
        name_words = [w for w in name.split() if len(w) > 3]
        score = 0
        if name in q or pid in q:
            score += 10
        for w in name_words:
            if w in q:
                score += 3
        for ing in item.get("ingredients", []):
            if ing.casefold() in q:
                score += 1
        if score > 0 or q in name:
            scored_matches.append((score, item))
    scored_matches.sort(key=lambda x: x[0], reverse=True)
    return [m[1] for m in scored_matches]

