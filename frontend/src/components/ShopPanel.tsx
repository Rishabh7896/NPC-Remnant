import { useEffect, useState } from 'react';
import { ShoppingBag, ShoppingCart, Receipt as ReceiptIcon, X, Plus, Trash2, Tag, Clock, AlertCircle, CheckCircle2, Coins, ArrowRight } from 'lucide-react';
import type { Cart, Product, Receipt, Wallet } from '../types';
import type { Stall } from '../scene/GameScene';
import { api } from '../api/client';

export type ShopPanelProps = {
  sessionId: string;
  activeStall: Stall | null;
  wallet: Wallet | null;
  cart: Cart | null;
  orders: Receipt[];
  viewMode: 'catalog' | 'cart' | 'receipts' | null;
  onClose: () => void;
  onCartUpdated: (cart: Cart) => void;
  onOrderPlaced: (receipt: Receipt, remainingBalance?: number) => void;
  onOpenMode: (mode: 'catalog' | 'cart' | 'receipts') => void;
};

export default function ShopPanel({
  sessionId,
  activeStall,
  wallet,
  cart,
  orders,
  viewMode,
  onClose,
  onCartUpdated,
  onOrderPlaced,
  onOpenMode,
}: ShopPanelProps) {
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [policy, setPolicy] = useState<{ max_discount_pct: number; min_cart_total: number; policy_note: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!activeStall || viewMode !== 'catalog') return;
    setLoading(true);
    setError('');
    api.catalog(sessionId, activeStall.id)
      .then((res) => {
        setCatalog(res.catalog);
        setPolicy(res.negotiation_policy);
        const initVariants: Record<string, string> = {};
        res.catalog.forEach((p) => {
          if (p.variants?.length) initVariants[p.product_id] = p.variants[0].id;
        });
        setSelectedVariants(initVariants);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load stall menu'))
      .finally(() => setLoading(false));
  }, [sessionId, activeStall, viewMode]);

  if (!viewMode) return null;

  const handleAddToCart = async (product: Product) => {
    try {
      setError('');
      const variantId = selectedVariants[product.product_id] || (product.variants?.[0]?.id || '');
      const addOnIds = selectedAddOns[product.product_id] || [];
      const res = await api.addToCart(sessionId, {
        vendor_id: product.vendor_id,
        product_id: product.product_id,
        quantity: 1,
        variant_id: variantId,
        add_on_ids: addOnIds,
      });
      onCartUpdated(res.cart);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    }
  };

  const handleRemoveItem = async (lineId: string) => {
    try {
      const res = await api.removeFromCart(sessionId, lineId, activeStall?.id || '');
      onCartUpdated(res.cart);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item');
    }
  };

  const handleClearCart = async () => {
    try {
      await api.clearCart(sessionId);
      if (cart) onCartUpdated({ ...cart, items: [], subtotal: 0, discount_amount: 0, total: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cart');
    }
  };

  const handleApplyDiscount = async () => {
    if (!activeStall) return;
    const amount = parseInt(discountInput, 10);
    if (isNaN(amount) || amount <= 0) return;
    try {
      const res = await api.applyDiscount(sessionId, activeStall.id, amount);
      onCartUpdated(res.cart);
      setDiscountInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply discount');
    }
  };

  const handleCheckout = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.checkout(sessionId, `web-${Date.now()}`);
      onOrderPlaced(res.receipt, res.receipt.balance_remaining);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleAddOn = (productId: string, addOnId: string) => {
    setSelectedAddOns((prev) => {
      const current = prev[productId] || [];
      const next = current.includes(addOnId)
        ? current.filter((id) => id !== addOnId)
        : [...current, addOnId];
      return { ...prev, [productId]: next };
    });
  };

  return (
    <div className="shop-modal-backdrop" onClick={onClose}>
      <div className="shop-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shop-modal-header">
          <div className="shop-modal-tabs">
            <button className={`tab-btn ${viewMode === 'catalog' ? 'active' : ''}`} onClick={() => onOpenMode('catalog')}>
              <ShoppingBag size={16} /> Stall Menu
            </button>
            <button className={`tab-btn ${viewMode === 'cart' ? 'active' : ''}`} onClick={() => onOpenMode('cart')}>
              <ShoppingCart size={16} /> Cart ({cart?.items?.length || 0})
            </button>
            <button className={`tab-btn ${viewMode === 'receipts' ? 'active' : ''}`} onClick={() => onOpenMode('receipts')}>
              <ReceiptIcon size={16} /> Receipts ({orders.length})
            </button>
          </div>
          <div className="shop-modal-top-right">
            <div className="wallet-chip">
              <Coins size={15} /> <span>₹{wallet?.balance ?? 500}</span>
            </div>
            <button className="close-btn" onClick={onClose} aria-label="Close modal">
              <X size={18} />
            </button>
          </div>
        </div>
        {error && <div className="shop-error-banner"><AlertCircle size={15} /> <span>{error}</span></div>}
        <div className="shop-modal-body">
          {viewMode === 'catalog' && (
            <div className="catalog-view">
              <div className="stall-info-card">
                <div>
                  <span className="eyebrow">FOOD STALL CATALOG</span>
                  <h2>{activeStall ? `${activeStall.food} · ${activeStall.vendor}` : 'Plaza Counter'}</h2>
                  {policy && <p className="policy-note"><Tag size={13} /> {policy.policy_note}</p>}
                </div>
              </div>

              {loading ? (
                <div className="shop-loading">Loading fresh stall menu…</div>
              ) : (
                <div className="product-grid">
                  {catalog.map((product) => {
                    const selectedVar = selectedVariants[product.product_id];
                    const activeVarObj = product.variants?.find((v) => v.id === selectedVar);
                    const varDelta = activeVarObj?.price_delta || 0;
                    const addOnSum = (selectedAddOns[product.product_id] || []).reduce((sum, id) => {
                      const ao = product.add_ons?.find((a) => a.id === id);
                      return sum + (ao?.price || 0);
                    }, 0);
                    const calculatedPrice = product.base_price + varDelta + addOnSum;

                    return (
                      <div className="product-card" key={product.product_id}>
                        <div className="product-card-top">
                          <div>
                            <span className="product-category">{product.category}</span>
                            <h3>{product.name}</h3>
                          </div>
                          <div className="price-tag">₹{calculatedPrice}</div>
                        </div>

                        <p className="product-desc">{product.description}</p>

                        <div className="product-meta">
                          <span><Clock size={12} /> {product.preparation_time}</span>
                          <span>• {product.stock_quantity} in stock</span>
                          {product.allergens.length > 0 && (
                            <span className="allergen-pill">
                              Allergens: {product.allergens.join(', ')}
                            </span>
                          )}
                        </div>

                        {product.variants?.length > 1 && (
                          <div className="variants-row">
                            <span className="label">Option:</span>
                            {product.variants.map((v) => (
                              <button
                                key={v.id}
                                className={`variant-chip ${selectedVar === v.id ? 'selected' : ''}`}
                                onClick={() => setSelectedVariants({ ...selectedVariants, [product.product_id]: v.id })}
                              >
                                {v.name} {v.price_delta > 0 ? `(+₹${v.price_delta})` : ''}
                              </button>
                            ))}
                          </div>
                        )}

                        {product.add_ons?.length > 0 && (
                          <div className="addons-row">
                            <span className="label">Add-ons:</span>
                            {product.add_ons.map((ao) => {
                              const isChecked = (selectedAddOns[product.product_id] || []).includes(ao.id);
                              return (
                                <button
                                  key={ao.id}
                                  className={`addon-chip ${isChecked ? 'checked' : ''}`}
                                  onClick={() => toggleAddOn(product.product_id, ao.id)}
                                >
                                  {isChecked ? '✓ ' : '+ '}{ao.name} (₹{ao.price})
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <div className="product-actions">
                          <button
                            className="add-to-cart-btn"
                            onClick={() => handleAddToCart(product)}
                            disabled={product.stock_quantity <= 0}
                          >
                            <Plus size={15} /> Add to Order (₹{calculatedPrice})
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {viewMode === 'cart' && (
            <div className="cart-view">
              <h2>Your Current Order</h2>
              {(!cart || cart.items.length === 0) ? (
                <div className="empty-cart-state">
                  <ShoppingBag size={36} />
                  <p>Your order is empty. Browse the stall menu or order naturally in chat!</p>
                  <button className="primary-btn" onClick={() => onOpenMode('catalog')}>
                    View Stall Menu
                  </button>
                </div>
              ) : (
                <div className="cart-content">
                  <div className="cart-items-list">
                    {cart.items.map((item) => (
                      <div className="cart-item-row" key={item.line_id}>
                        <div className="cart-item-info">
                          <b>{item.quantity}x {item.name}</b>
                          {item.variant && <span className="item-variant">{item.variant.name}</span>}
                          {item.add_ons?.map((a) => (
                            <span className="item-addon" key={a.id}>+ {a.name}</span>
                          ))}
                        </div>
                        <div className="cart-item-price">
                          <span>₹{item.line_total}</span>
                          <button
                            className="remove-btn"
                            onClick={() => handleRemoveItem(item.line_id)}
                            title="Remove item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="cart-bargain-box">
                    <span className="eyebrow"><Tag size={12} /> CONVERSATIONAL BARGAINING</span>
                    <p>Vendors permit rule-constrained discounts! You can negotiate in chat or propose an offer:</p>
                    <div className="bargain-row">
                      <input
                        type="number"
                        placeholder="Discount in ₹"
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                        min={1}
                        max={100}
                      />
                      <button onClick={handleApplyDiscount}>Propose Discount</button>
                    </div>
                  </div>

                  <div className="cart-summary">
                    <div className="summary-line">
                      <span>Subtotal</span>
                      <span>₹{cart.subtotal}</span>
                    </div>
                    {cart.discount_amount > 0 && (
                      <div className="summary-line discount">
                        <span>Approved Discount</span>
                        <span>-₹{cart.discount_amount}</span>
                      </div>
                    )}
                    <div className="summary-line total">
                      <span>Total Payable</span>
                      <span>₹{cart.total}</span>
                    </div>

                    <div className="checkout-actions">
                      <button className="clear-btn" onClick={handleClearCart}>
                        Clear Cart
                      </button>
                      <button
                        className="checkout-btn"
                        onClick={handleCheckout}
                        disabled={loading || (wallet !== null && wallet.balance < cart.total)}
                      >
                        {loading ? 'Confirming…' : `Place Order · Pay ₹${cart.total}`}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    {wallet && wallet.balance < cart.total && (
                      <p className="insufficient-funds-warning">
                        Insufficient balance (₹{wallet.balance} in wallet). Ask vendor for a discount or remove items.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {viewMode === 'receipts' && (
            <div className="receipts-view">
              <h2>Order Receipts & History</h2>
              {orders.length === 0 ? (
                <div className="empty-cart-state">
                  <ReceiptIcon size={36} />
                  <p>No completed orders yet. Place an order through chat or the stall menu!</p>
                </div>
              ) : (
                <div className="receipts-list">
                  {orders.map((rec) => (
                    <div className="receipt-card" key={rec.order_id}>
                      <div className="receipt-header">
                        <div>
                          <b>Order #{rec.order_id}</b>
                          <span className="receipt-vendor">{rec.vendor_name}</span>
                        </div>
                        <span className="receipt-status"><CheckCircle2 size={13} /> {rec.status.toUpperCase()}</span>
                      </div>
                      <div className="receipt-items">
                        {rec.items.map((it, idx) => (
                          <div className="receipt-item-line" key={idx}>
                            <span>{it.quantity}x {it.name}</span>
                            <span>₹{it.line_total}</span>
                          </div>
                        ))}
                      </div>
                      <div className="receipt-footer">
                        <span>Total Paid: ₹{rec.total}</span>
                        <small>{new Date(rec.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
