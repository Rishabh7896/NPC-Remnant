# API contract

Base path: `/api/v1`

### Core Session & Dialogue
- `GET /health` -> service status and local Ollama model availability
- `GET /sessions/stalls` -> authored plaza menu and vendor context
- `POST /sessions` -> creates a persistent plaza session
- `GET /sessions/{id}` -> session, mission, and world state
- `GET /sessions/{id}/messages` -> complete saved conversation across vendors
- `POST /sessions/{id}/dialogue` body `{ "message": "...", "location": "evening_food_plaza", "npc_id": "pani-puri" }`
- `POST /sessions/{id}/interact` body with the same shape -> LLM resolves freeform input into navigation, a vendor conversation, or plaza chat. Navigation responses include `action.stall_id`.
- `GET /sessions/{id}/memories?limit=50` -> LLM-extracted personal memories and conflicts

### Conversational Commerce & Shopkeeper Endpoints
- `GET /sessions/{id}/shop/catalog/{vendor_id}` -> Authoritative stall product catalog, variants, add-ons, stock, ingredients, allergens, and negotiation policy
- `GET /sessions/{id}/cart` -> Current active draft cart (items, subtotal, discount, total, state)
- `POST /sessions/{id}/cart/items` body `{ "vendor_id": "...", "product_id": "...", "quantity": 1, "variant_id": "...", "add_on_ids": ["..."] }` -> Add/update item in draft cart
- `DELETE /sessions/{id}/cart/items/{item_id}` -> Remove line item from cart
- `POST /sessions/{id}/cart/discount` body `{ "vendor_id": "...", "proposed_discount": 10 }` -> Apply negotiated discount validated against vendor policy
- `POST /sessions/{id}/cart/checkout` body `{ "idempotency_key": "..." }` -> Atomically commit order, decrement inventory, debit player wallet, generate receipt
- `POST /sessions/{id}/cart/clear` -> Clear all items from draft cart
- `GET /sessions/{id}/orders` -> Order history with verified receipts
- `GET /sessions/{id}/wallet` -> In-game virtual currency balance and ledger

For each interaction, the backend loads recent plaza history and saved memories, asks the configured local LLM (Qwen via Ollama) to interpret intent and resolve a stall, then either sets a movement destination, generates a character reply, or validates and executes typed commerce actions (adding to cart, negotiating discount, atomic checkout). Authoritative prices and stock are validated on the backend.
