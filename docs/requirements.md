# Echoes After Hours — Requirements Specification

# 31. Local LLM-Powered Shopkeepers and Conversational Commerce

## 31.1 Objective

Implement an AI-powered shopkeeper system in which every food stall has a conversational vendor who can explain products, answer questions, recommend food, discuss prices, handle purchase requests, and complete validated in-game transactions.

The system must prioritize a locally running LLM for player conversations.

The initial local inference setup should support the existing Ollama integration and configured local model, such as Qwen3:8b, if it is installed and performs adequately on the host machine.

The architecture must allow changing the local model without rewriting shopkeeper logic.

The primary goal is to make players feel as if they are talking to a real shopkeeper who understands their needs, knows their products, remembers their preferences, and can actually sell them items in the game.

## 31.2 Local-first LLM architecture

Use the local LLM as the default conversational provider for supported interactions.

Expected request flow:

1. The player types or speaks to a shopkeeper.
2. The game resolves the active vendor and stall.
3. The backend retrieves the vendor's identity, product catalog, inventory, prices, player preferences, relevant memories, and current transaction state.
4. The local LLM interprets the message and generates a natural-language response.
5. If an action is requested, the LLM proposes a typed intent and structured parameters.
6. The backend validates the intent against authoritative game data and business rules.
7. The backend executes the permitted action.
8. The transaction and resulting state are persisted.
9. The vendor responds naturally, explaining the actual outcome.
10. The response is displayed and spoken through the configured voice system.

Use a provider abstraction so the application can support:

- Local Ollama models.
- Other compatible local inference servers.
- Existing Gemini integration.
- Existing OpenAI-compatible providers.
- Deterministic fallback dialogue.

Cloud providers must not be called for every request by default. Any cloud fallback must be explicitly configured, and the privacy policy must determine which conversation data may be sent externally.

## 31.3 Local model configuration

Centralize configuration for:

- Provider type.
- Local inference base URL.
- Model name.
- Request timeout.
- Maximum input context.
- Maximum output tokens.
- Temperature and other supported generation settings.
- Streaming behavior.
- Maximum concurrent generations.
- Health-check interval.
- Retry policy.
- Optional cloud fallback.
- Offline fallback behavior.

Provide a safe example configuration for local development.

Do not hardcode machine-specific URLs throughout the codebase. Keep the default local endpoint configurable and document how the frontend, backend, and inference service communicate.

The backend should call the local inference service directly. The browser must not receive privileged provider credentials.

At startup, validate that the configured provider is reachable and the required model is available. If not, provide an actionable error and enter the configured fallback mode rather than silently pretending that local inference is working.

## 31.4 Shopkeeper identity and context

Each stall must have an independent shopkeeper profile.

The profile must include:

- Stable vendor ID and stall ID.
- Name, background, personality, and conversational style.
- Products sold.
- Product categories.
- Current prices and supported variants.
- Ingredients and allergen information where available.
- Portion sizes and preparation options.
- Inventory and availability.
- Preparation time estimates, if modeled.
- Supported discounts and negotiation rules.
- Opening or availability state within the game.
- Related quests and story information.
- Customer preferences and relevant memories.
- Relationship state with the player.
- Voice profile.

A shopkeeper should know only the products and facts appropriate to their role, unless the game explicitly provides broader knowledge.

For example, a dosa vendor should be able to explain dosa varieties, fillings, chutneys, spice levels, and available combinations using the configured product data.

A chai vendor should understand available chai types, sizes, sweetness options, and add-ons.

Personality may be creative; authoritative product and transaction data must not be fabricated.


## 31.5 Product catalog and dynamic dialogue

The backend must maintain a structured catalog for all purchasable items.

Each product should include fields such as:

- `product_id`
- `vendor_id`
- `name`
- `description`
- `category`
- `base_price`
- `currency`
- `available`
- `stock_quantity`, if stock is tracked
- `variants`
- `add_ons`
- `ingredients`
- `allergens`, where known
- `preparation_time`, if modeled
- `max_quantity_per_order`
- `discount_eligibility`
- `version`

Use a relational database or an appropriate existing persistence layer as the source of truth.

The LLM should generate product explanations and recommendations from the retrieved catalog. It must not be required to memorize the entire menu in its system prompt.

Examples of natural interactions:

- "What do you sell here?"
- "What's your most popular dosa?"
- "How much is the masala dosa?"
- "What can I get for ₹100?"
- "I don't want anything too spicy. What do you recommend?"
- "Can I get two masala dosas and one chai?"
- "What's the difference between these two dishes?"
- "Does this contain peanuts?"
- "Can you make it less spicy?"
- "What is the cheapest thing on your menu?"

The model should answer naturally, use real catalog data, and ask follow-up questions when a required selection is unclear.

If allergen or ingredient information is missing, the shopkeeper must say that the information is not available rather than inventing an answer.

## 31.6 LLM-generated prices and offers

The requirement for LLM-generated prices must be implemented as **dynamic price presentation and rule-constrained offer generation**, not unrestricted fabrication of transaction prices.

The LLM may:

- Explain catalog prices conversationally.
- Recommend items within the player's budget.
- Suggest product combinations.
- Offer configured bundles.
- Propose an eligible discount.
- Generate a personalized offer within predefined limits.
- Use a vendor-specific negotiation style.
- Explain why a discount is or is not available.
- Suggest an alternative when the player's budget is insufficient.

The backend must determine the final payable amount.

For every purchase, the backend must calculate the price from the current catalog and validated pricing rules.

The LLM must never independently invent a lower price and charge that amount without validation.

### Pricing rules

Each item may define:

- Base price.
- Permitted variants and their price adjustments.
- Add-on prices.
- Quantity limits.
- Eligible discounts.
- Minimum permitted price.
- Maximum discount.
- Vendor-specific negotiation policy.
- Promotional offers and their validity.
- Applicable taxes or fees, if the game models them.

All prices must use a consistent currency representation. For INR, use integer paise or a decimal-safe money type rather than binary floating-point arithmetic.

A suggested offer is only a proposal until the backend validates and accepts it.

Example:

The catalog price of a masala dosa is ₹80. The player asks, "Can you give me a discount?"

The LLM responds in the vendor's personality and proposes an eligible offer.

The backend checks the discount policy, minimum price, applicable limits, and any player eligibility rules. It then returns the approved offer or rejects the proposal.

The shopkeeper explains the actual approved price conversationally.

If no discount is permitted, the vendor may negotiate playfully in dialogue without changing the authoritative price.

## 31.7 Conversational purchase flow

Players must be able to purchase products using natural language instead of navigating a rigid checkout interface.

Example conversation:

Player: "I'm hungry. What do you recommend?"

Vendor: "If you want something filling, I'd go with the masala dosa. The potato filling is nicely spiced, and it comes with chutney."

Player: "How much?"

Vendor: "It's ₹80. Want to try one?"

Player: "Can you make it less spicy? And add a chai."

Vendor: "Absolutely. One less-spicy masala dosa and a chai. That comes to ₹130. Shall I place the order?"

The backend must validate the catalog price and options and calculate the total of ₹130 only if those values match the configured menu.

Player: "Yes, go ahead."

Vendor: "Done! Your order is placed. I'll have it ready shortly."

The order is confirmed only after the backend successfully commits the transaction.

If the catalog, inventory, or prices differ from the example, the actual configured values take precedence.

## 31.8 Shopping intent and conversation state

Maintain explicit conversation and transaction state so that the LLM understands whether the player is exploring, considering, or confirming an order.

Suggested interaction states:

- `browsing`
- `asking_product_question`
- `building_cart`
- `awaiting_clarification`
- `awaiting_confirmation`
- `submitting_order`
- `order_confirmed`
- `order_failed`
- `cancelled`

The LLM may propose a state transition, but the backend must validate it.

The system must distinguish clearly between:

- A hypothetical purchase.
- A request to prepare a cart.
- An offer or quote.
- A request to place an order.
- Explicit confirmation.
- A completed order.

If a player asks, "What if I bought three dosas?", the system must not place an order.

If the player says, "Add two dosas to my order," update the draft cart after validation.

If the player says, "Order it," and the current cart is unambiguous, request confirmation if required by the transaction policy.

Never infer purchase confirmation from ambiguous language.


## 31.9 Cart management

Implement a persistent or appropriately scoped draft cart.

Required operations:

- Add an item.
- Remove an item.
- Change quantity.
- Select product variants.
- Select permitted customizations.
- Add or remove eligible add-ons.
- View cart.
- Calculate subtotal.
- Apply a validated discount.
- Recalculate the total.
- Confirm the cart.
- Cancel the cart.
- Recover from a failed order.

Every cart line must reference a valid product and vendor.

The cart must store product identifiers and selections rather than trusting model-generated names and prices.

The backend must recalculate the total whenever the cart changes and again during checkout.

If the price or availability changes before confirmation, explain the change and obtain the required confirmation before completing the order.

## 31.10 Purchase execution and transaction integrity

Implement a backend-controlled order service.

A valid purchase should:

1. Validate the player identity and vendor.
2. Validate every product and selected variant.
3. Verify item availability.
4. Validate quantities and customization options.
5. Recalculate prices and discounts.
6. Verify the player's in-game currency or other configured payment method.
7. Obtain the required confirmation.
8. Atomically create the order and its line items.
9. Deduct in-game currency or reserve inventory where applicable.
10. Record the transaction.
11. Publish the resulting game event.
12. Return the actual committed order state.
13. Generate the vendor's conversational confirmation from that result.

Where the selected database supports transactions, related order, currency, and inventory changes must be committed atomically.

Use idempotency keys or equivalent safeguards so that retries cannot create duplicate orders or charge the player twice.

Never tell the player that an order succeeded before the transaction is committed.

If an operation fails, restore or retain a consistent state and provide a clear recovery path.

## 31.11 Inventory management

Support one of two explicit product models per game mode:

**Unlimited inventory:** Items remain available unless the game explicitly disables them.

**Tracked inventory:** Items have stock quantities, and orders decrement or reserve available quantities.

For tracked inventory:

- Prevent purchases beyond available stock.
- Prevent negative inventory.
- Handle concurrent purchase attempts safely.
- Release reservations after cancellation or expiration where applicable.
- Persist inventory changes.
- Trigger an appropriate vendor response when an item is unavailable.
- Offer available alternatives when useful.

The LLM may suggest alternatives but must only recommend items that exist in the catalog and are currently eligible for sale.

## 31.12 In-game currency and receipts

If the game uses virtual currency, maintain an authoritative player balance.

Requirements:

- Use a consistent currency unit.
- Record each debit and credit.
- Prevent negative balances unless explicitly supported.
- Validate every currency mutation.
- Make transactions idempotent.
- Persist a transaction history.
- Support refunds or reversals through explicit game rules.
- Ensure rewards and purchase operations cannot duplicate currency.

If the player cannot afford an order, the vendor should respond naturally and offer an alternative within the available budget.

Do not integrate real-world payment processing unless explicitly required. The initial purchase system should be an in-game economy.

## 31.13 Persistent orders and vendor memory

Store order records with:

- Order ID.
- Player ID.
- Vendor ID.
- Order lines.
- Confirmed prices.
- Applied discounts.
- Total amount.
- Transaction status.
- Relevant timestamps.
- Idempotency identifier.
- Source conversation or event reference where appropriate.

Shopkeepers may remember meaningful order history and use it in future conversations.

Examples:

- "Your usual masala dosa?"
- "Last time you wanted less spice. Shall I make it that way again?"
- "You liked the ginger chai when you visited earlier."

Only use these responses when the underlying order or preference has actually been persisted.

Do not send the entire order history into every prompt. Retrieve relevant summaries or records as needed.

## 31.14 Structured LLM action contract

The model should return a validated response object when structured output is supported.

Example logical schema:

```json
{
  "reply_text": "The masala dosa is ₹80. Want me to add one?",
  "intent": "add_to_cart",
  "vendor_id": "dosa_vendor",
  "items": [
    {
      "product_id": "masala_dosa",
      "quantity": 1,
      "variant_id": null,
      "add_on_ids": []
    }
  ],
  "requires_clarification": false,
  "requires_confirmation": true
}
```

This is an illustrative schema, not a fixed product catalog or an instruction to trust model output.

The backend must validate every field against the actual catalog and current conversation state.

Use server-derived vendor context and player identity. Reject unauthorized or unknown product IDs, invalid quantities, unsupported variants, and malformed actions.

The model's proposed response must never directly mutate the database.



## 31.15 API capabilities

Review existing routes before introducing new ones. Reuse current contracts where practical.

Potential capabilities include:

- Retrieve vendor details.
- Retrieve the vendor's catalog.
- Ask a vendor a question.
- Create or retrieve a draft cart.
- Add or remove cart items.
- Update item quantity and customization.
- Retrieve a current price quote.
- Request a validated discount.
- Confirm an order.
- Retrieve order status.
- Cancel an eligible order.
- Retrieve purchase history.
- Retrieve player currency balance.

Every endpoint must implement validation, authorization, bounded timeouts, structured errors, and idempotency where required.

Do not expose direct unrestricted inventory, price, or currency mutation endpoints to the browser.

## 31.16 Local inference reliability

The local model is a dependency that can fail and must be treated accordingly.

Implement:

- Startup validation.
- Model availability checks.
- Request timeouts.
- Bounded concurrency.
- Cancellation when a request is no longer needed, where supported.
- Context-size management.
- Output validation.
- Recoverable errors.
- Deterministic fallback responses.
- Health and latency metrics.

If local inference is unavailable, the player must still be able to move, inspect the menu, view actual prices, and use any supported deterministic purchase flow.

Do not silently route conversations to a cloud provider when local inference fails unless cloud fallback is enabled and permitted by the configured privacy policy.

## 31.17 Evaluation and acceptance criteria

The feature is accepted only when the following are verified:

1. The application uses the configured local LLM for normal supported shopkeeper conversations.
2. The player can ask natural-language product questions.
3. The vendor responds using the correct vendor-specific context.
4. The vendor recommends products from the actual catalog.
5. Prices match the authoritative catalog and validated pricing rules.
6. Negotiation never bypasses configured discount limits.
7. The player can create and modify a cart conversationally.
8. Ambiguous purchases trigger clarification or confirmation.
9. A confirmed order is persisted correctly.
10. Inventory and in-game currency remain consistent.
11. Retried requests cannot duplicate purchases.
12. Failed transactions never produce false success messages.
13. The vendor can accurately recall persisted order history when relevant.
14. A missing or unavailable product is handled gracefully.
15. Local LLM failure does not break core game navigation or safe menu access.
16. Cloud fallback respects explicit configuration and privacy rules.
17. Unit, integration, and end-to-end tests cover the complete purchase journey.

## 31.18 Required implementation order

1. Audit the existing Ollama integration and vendor context builder.
2. Centralize vendor and product configuration.
3. Implement the catalog and authoritative price service.
4. Add natural-language product discovery and recommendations.
5. Implement typed shopping intents and validation.
6. Implement the draft cart and quote calculation.
7. Implement confirmed orders, inventory, and virtual currency.
8. Add idempotency and transaction safeguards.
9. Integrate persistent order history with character memory.
10. Add natural voice delivery for shopping conversations.
11. Test provider failures, incorrect model outputs, and duplicate requests.
12. Demonstrate the complete experience in the 3D game.

Do not declare conversational commerce complete until the player can ask about a real catalog item, receive its correct price, place an order through dialogue, see the actual game state update, and return later to find the order history preserved.

## Recommended architecture for your local setup

```
3D game and voice UI
  │
  ▼
Player movement, dialogue, menus, cart and order feedback
  │
  ▼
Python backend
Context building · validation · memory · shop rules · transactions
  │                    │
  ▼                    ▼
Local Ollama       Persistent database
Qwen3:8b or another  Catalog, prices, carts, orders,
configured model   memories and player state
  │                    │
  ▼                    ▼
Conversation and intent   Authoritative data
  │                    │
  └──────────┬─────────┘
             │
             ▼
      Validated game actions
Approved offer → confirmed purchase → persistent state change → conversational response
```

One important decision: keep prices and inventory in structured data, while letting the LLM generate the way the vendor talks about them. If you want dynamic bargaining, have the LLM propose a price within explicit rules and let the backend approve or reject it. That delivers genuinely conversational shopping without inconsistent prices or broken game state.

