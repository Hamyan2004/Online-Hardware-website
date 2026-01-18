// Common JavaScript functionality for the website

// Global Image Error Handler - Auto-generates placeholders if images fail to load
document.addEventListener('error', function (e) {
    if (e.target.tagName.toLowerCase() === 'img') {
        // Prevent infinite loop if the placeholder itself fails
        if (e.target.dataset.fixed) return;
        e.target.dataset.fixed = "true";

        const text = e.target.alt || 'Product';
        const width = e.target.width || 300;
        const height = e.target.height || 300;

        // Generate dynamic SVG placeholder
        const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#f3f4f6"/>
            <text x="50%" y="50%" font-family="Arial" font-size="20" fill="#6b7280" text-anchor="middle" dy=".3em">${text}</text>
        </svg>`;

        e.target.src = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
    }
}, true); // Capture phase to catch error events

// Smooth scroll for anchor links
document.addEventListener('DOMContentLoaded', function () {
    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Mobile menu toggle (if needed)
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function () {
            navLinks.classList.toggle('active');
        });
    }

    // Add active class to current page nav link
    const currentPage = window.location.pathname.split('/').pop() || 'homepage.html';
    document.querySelectorAll('.nav-links a').forEach(link => {
        const linkPage = link.getAttribute('href');
        if (linkPage === currentPage || (currentPage === '' && linkPage === 'homepage.html')) {
            link.classList.add('active');
        }
    });
});

// Cart functionality (localStorage)
const Cart = {
    items: [],

    init: function () {
        // Load and validate items
        const stored = localStorage.getItem('cart');
        if (stored) {
            try {
                this.items = JSON.parse(stored);
                this.validate(); // Clean up bad data immediately
            } catch (e) {
                console.error('Cart data corrupted, resetting:', e);
                this.items = [];
            }
        }

        this.updateBadge(); // Update badge immediately on load

        // Only try to render if we are on the cart page (element exists)
        if (document.getElementById('cartContent')) {
            this.render();
            this.setupEventListeners();
        }
    },

    setupEventListeners: function () {
        // Event delegation for cart actions
        const cartContent = document.getElementById('cartContent');
        if (cartContent) {
            cartContent.addEventListener('click', (e) => {
                const target = e.target;

                // Handle Remove
                const removeBtn = target.closest('.remove-btn');
                if (removeBtn) {
                    const id = removeBtn.dataset.id;
                    if (id) this.remove(id);
                    return;
                }

                // Handle Quantity Buttons
                const qtyBtn = target.closest('.qty-btn');
                if (qtyBtn) {
                    const id = qtyBtn.dataset.id;
                    const action = qtyBtn.dataset.action;
                    const currentQty = parseInt(qtyBtn.dataset.qty);

                    if (id && action === 'increase') {
                        this.updateQuantity(id, currentQty + 1);
                    } else if (id && action === 'decrease') {
                        this.updateQuantity(id, currentQty - 1);
                    }
                    return;
                }
            });

            // Handle Quantity Input Change
            cartContent.addEventListener('change', (e) => {
                if (e.target.classList.contains('qty-input')) {
                    const id = e.target.dataset.id;
                    const newQty = parseInt(e.target.value);
                    if (id) this.updateQuantity(id, newQty);
                }
            });
        }
    },

    validate: function () {
        // 1. Filter out completely invalid items (missing ID/Name/Price)
        const initialCount = this.items.length;
        this.items = this.items.filter(item => {
            return item &&
                item.id &&
                typeof item.id === 'string' &&
                item.name;
            // Note: We'll fix price in the next step, so we don't drop items just for bad price format yet
        });

        // 2. Deduplicate items by ID
        const uniqueItems = {};
        this.items.forEach(item => {
            // Normalize ID
            const id = item.id;

            // Normalize Quantity
            let qty = parseInt(item.quantity);
            if (isNaN(qty) || qty < 1) qty = 1;

            // Normalize Price
            let priceStr = item.price;
            if (typeof priceStr !== 'string') priceStr = String(priceStr || '0');

            if (uniqueItems[id]) {
                // If item exists, merge quantity
                uniqueItems[id].quantity += qty;
            } else {
                // New item
                uniqueItems[id] = {
                    ...item,
                    id: id,
                    quantity: qty,
                    price: priceStr
                };
            }
        });

        // Convert back to array
        this.items = Object.values(uniqueItems);

        if (this.items.length !== initialCount) {
            console.log('Cleaned up and merged corrupt/duplicate cart items');
            this.save();
        }
    },

    add: function (product) {
        if (!product.id) return;

        // Ensure price is stored as string
        if (product.price && typeof product.price !== 'string') {
            product.price = String(product.price);
        }

        const existingItem = this.items.find(item => item.id === product.id);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.items.push({ ...product, quantity: 1 });
        }
        this.save();
        this.updateBadge();
        showNotification(`${product.name} added to cart!`);
    },

    remove: function (productId) {
        this.items = this.items.filter(item => item.id !== productId);
        this.save();
        this.updateBadge();
        this.render();
    },

    updateQuantity: function (productId, quantity) {
        const item = this.items.find(item => item.id === productId);
        if (item) {
            const newQty = parseInt(quantity);
            if (newQty <= 0) {
                this.remove(productId);
            } else {
                item.quantity = newQty;
                this.save();
                this.render();
            }
        }
        this.updateBadge();
    },

    clear: function () {
        this.items = [];
        this.save();
        this.updateBadge();
        this.render();
    },

    getTotal: function () {
        return this.items.reduce((total, item) => {
            let priceStr = item.price;
            if (typeof priceStr !== 'string') {
                priceStr = String(priceStr || '0');
            }
            const price = parseFloat(priceStr.replace(/[^\d.]/g, '')) || 0;
            return total + (price * (item.quantity || 1));
        }, 0);
    },

    save: function () {
        localStorage.setItem('cart', JSON.stringify(this.items));
    },

    updateBadge: function () {
        document.querySelectorAll('.cart-badge').forEach(badge => {
            const totalItems = this.items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
            badge.textContent = totalItems;
            badge.style.display = totalItems > 0 ? 'inline-block' : 'none';
        });
    },

    render: function () {
        const cartContent = document.getElementById('cartContent');
        if (!cartContent) return;

        if (!this.items || this.items.length === 0) {
            cartContent.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-cart"></i>
                    <h2>Your cart is empty</h2>
                    <p>Looks like you haven't added any products yet.</p>
                    <a href="products.html" class="btn btn-primary" style="margin-top: 1rem;">Start Shopping</a>
                </div>
            `;
            return;
        }

        let html = `
            <div class="cart-header">
                <div>Product</div>
                <div style="text-align: center;">Price</div>
                <div style="text-align: center;">Quantity</div>
                <div style="text-align: right;">Total</div>
                <div></div>
            </div>
        `;

        this.items.forEach(item => {
            try {
                let priceStr = item.price;
                if (typeof priceStr !== 'string') priceStr = String(priceStr || '0');

                const priceVal = parseFloat(priceStr.replace(/[^\d.]/g, '')) || 0;
                const quantity = parseInt(item.quantity) || 1;
                const total = priceVal * quantity;
                const imgSrc = item.image || 'https://via.placeholder.com/80';
                const name = item.name || 'Unknown Product';
                const category = item.category || 'Hardware';

                html += `
                    <div class="cart-item">
                        <div class="item-info">
                            <img src="${imgSrc}" alt="${name}" class="item-img" onerror="this.src='https://via.placeholder.com/80'">
                            <div class="item-details">
                                <h3>${name}</h3>
                                <p>${category}</p>
                            </div>
                        </div>
                        <div style="text-align: center;" data-label="Price:">
                            ${priceStr}
                        </div>
                        <div style="text-align: center;" data-label="Quantity:">
                            <div class="quantity-controls" style="justify-content: center;">
                                <button class="qty-btn" data-id="${item.id}" data-action="decrease" data-qty="${quantity}">-</button>
                                <input type="number" class="qty-input" value="${quantity}" min="1" data-id="${item.id}">
                                <button class="qty-btn" data-id="${item.id}" data-action="increase" data-qty="${quantity}">+</button>
                            </div>
                        </div>
                        <div style="text-align: right; font-weight: 600;" data-label="Total:">
                            LKR ${total.toLocaleString()}
                        </div>
                        <div style="text-align: right;">
                            <button class="remove-btn" data-id="${item.id}">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                `;
            } catch (e) {
                console.error('Error rendering cart item:', e);
            }
        });

        html += `
            <div class="cart-summary">
                <div class="summary-card">
                    <div class="summary-row">
                        <span>Subtotal</span>
                        <span>LKR ${this.getTotal().toLocaleString()}</span>
                    </div>
                    <div class="summary-row">
                        <span>Shipping</span>
                        <span>Calculated at checkout</span>
                    </div>
                    <div class="summary-row summary-total">
                        <span>Total</span>
                        <span>LKR ${this.getTotal().toLocaleString()}</span>
                    </div>
                    <button class="btn btn-primary checkout-btn" onclick="alert('Checkout functionality coming soon!')">
                        Proceed to Checkout
                    </button>
                </div>
            </div>
        `;

        cartContent.innerHTML = html;
    }
};

// Initialize functionalities
document.addEventListener('DOMContentLoaded', function initializeApp() {
    Cart.init();

    // Add event listeners for "Add to Cart" buttons
    document.querySelectorAll('.btn-cart').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            const card = this.closest('.product-card');
            if (card) {
                // Generate a robust ID if data-id is missing
                let id = card.dataset.id;
                if (!id) {
                    const name = card.querySelector('h3').textContent.trim();
                    id = name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
                }

                const product = {
                    id: id,
                    name: card.querySelector('h3').textContent.trim(),
                    price: card.querySelector('.product-price').textContent.trim(),
                    image: card.querySelector('.product-img').src,
                    category: card.querySelector('.product-category') ? card.querySelector('.product-category').textContent.trim() : ''
                };
                Cart.add(product);
            }
        });
    });
});

// Form validation
function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;

    const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
    let isValid = true;

    inputs.forEach(input => {
        if (!input.value.trim()) {
            isValid = false;
            input.style.borderColor = '#ef4444';
            input.addEventListener('input', function () {
                this.style.borderColor = '#e5e7eb';
            }, { once: true });
        }
    });

    return isValid;
}

// Email validation
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Phone validation
function validatePhone(phone) {
    const re = /^[\d\s\-\+\(\)]+$/;
    return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 1rem 2rem;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
