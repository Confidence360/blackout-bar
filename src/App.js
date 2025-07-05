import React, { useState, useEffect, useRef } from 'react';
import './Mobile.css';
import { db } from './firebase';
import {
  collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, doc, getDoc, setDoc, deleteDoc
}
from 'firebase/firestore';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';




function App() {
  const [drinkList, setDrinkList] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState('drinks');
  const [tableNumber, setTableNumber] = useState('');
  const [orders, setOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastOrderTimestamp, setLastOrderTimestamp] = useState(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [visibilityLoading, setVisibilityLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(true); // <-- For Welcome message display
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]   = useState('');

 const [showSavedDrinks, setShowSavedDrinks] = useState(false);
const [customerPhone, setCustomerPhone] = useState('');
const [savedDrinksInput, setSavedDrinksInput] = useState('');
const [savedDrinksList, setSavedDrinksList] = useState([]);
const saveCustomerDrinks = async () => {
  if (!customerPhone || !savedDrinksInput) {
    alert('Please enter a phone number and drinks.');
    return;
  }
  try {
    await addDoc(collection(db, 'saved_drinks'), {
      phone: customerPhone,
      drinks: savedDrinksInput,
      timestamp: new Date(),
    });
    alert('Drinks saved successfully!');
    setCustomerPhone('');
    setSavedDrinksInput('');
    fetchSavedDrinks();
  } catch (error) {
    console.error('Error saving drinks: ', error);
    alert('Failed to save drinks.');
  }
};

const fetchSavedDrinks = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'saved_drinks'));
    const drinks = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    setSavedDrinksList(drinks);
  } catch (error) {
    console.error('Error fetching saved drinks: ', error);
  }
};

const deleteSavedDrink = async (id) => {
  try {
    await deleteDoc(doc(db, 'saved_drinks', id));
    fetchSavedDrinks();
  } catch (error) {
    console.error('Error deleting drink: ', error);
  }
};
  // QR Payment
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentQRUrl, setPaymentQRUrl] = useState('');
  const [adminQRInput, setAdminQRInput] = useState('');
  const [qrLoading, setQrLoading] = useState(true);
  // Visual feedback for Add to Cart buttons
  const [addedItemIds, setAddedItemIds] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false); // ⛔ prevents double order
  const isSubmittingRef = useRef(false);

  const audioRef = useRef(new Audio('/alert.mp3'));
  const adminPassword = '1234';

  // Fetch drinks from Google Apps Script endpoint
  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbwIFfJUcYsdQpq_0LHebNkwl7-rfLRhyVOVld25rkwa6_J6FeU8yoPzfFfX_EVS27pB6Q/exec')
      .then(res => res.json())
      .then(data => {
        const formatted = data.filter(item => item && item.name).map((item, index) => ({
          id: item.id || index.toString(),
          name: String(item.name || ''),
          description: item.description || '',
          image: item.image || '',
          price: parseFloat(item.price) || 0,
          category: item.category || 'Uncategorized',
        }));
        setDrinkList(formatted);
      })
      .catch(() => alert('Failed to load drinks. Please check your data source.'));
  }, []);

  // Unlock audio on user interaction once
  useEffect(() => {
    const unlockAudio = () => {
      audioRef.current.play().catch(() => {});
      document.removeEventListener('click', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    return () => document.removeEventListener('click', unlockAudio);
  }, []);

  // Fetch visibility setting from Firestore
  useEffect(() => {
  const visibilityRef = doc(db, 'settings', 'visibility');
  const unsubscribe = onSnapshot(visibilityRef, snapshot => {
    const data = snapshot.data();
    if (data) {
      setIsVisible(data.isVisible);
    }
  });

  return () => unsubscribe();
}, []);

  // Subscribe to live orders and play alert sound on new order
  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, snapshot => {
      const liveOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(prev => {
        const latestOrder = liveOrders[0];
        if (latestOrder?.timestamp?.seconds !== lastOrderTimestamp) {
          setLastOrderTimestamp(latestOrder?.timestamp?.seconds);
          if (document.visibilityState === 'visible') {
            audioRef.current.play().catch(() => {});
          }
        }
        return liveOrders;
      });
    });
    return () => unsubscribe();
  }, [lastOrderTimestamp]);

  // Fetch payment QR code URL from Firestore
  useEffect(() => {
    const fetchPaymentQR = async () => {
      try {
        const qrDocRef = doc(db, 'settings', 'paymentQR');
        const qrDocSnap = await getDoc(qrDocRef);
        if (qrDocSnap.exists()) {
          setPaymentQRUrl(qrDocSnap.data().url || '');
          setAdminQRInput(qrDocSnap.data().url || '');
        }
      } catch (err) {
        console.error('Failed to fetch payment QR code URL:', err);
      }
      setQrLoading(false);
    };
    fetchPaymentQR();
  }, []);

  // Restore Welcome message & auto-login display logic
  useEffect(() => {
    // Show welcome message for 3 seconds then hide
    if (showWelcome) {
      const timer = setTimeout(() => {
        setShowWelcome(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showWelcome]);

  // Add to cart function with visual feedback
  const addToCart = (drink) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === drink.id);
      if (existing) {
        return prevCart.map(item =>
          item.id === drink.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prevCart, { ...drink, quantity: 1 }];
      }
    });

    setAddedItemIds(prev => [...prev, drink.id]);
    setTimeout(() => {
      setAddedItemIds(prev => prev.filter(id => id !== drink.id));
    }, 1000);
  };

  // Quantity update and removal
  const updateQuantity = (id, amount) => {
    setCart(prev =>
      prev.map(item =>
        item.id === id ? { ...item, quantity: Math.max(1, item.quantity + amount) } : item
      )
    );
  };

  const removeItem = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // Cart totals and categories
  const getTotal = () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItemsInCart = cart.reduce((sum, item) => sum + item.quantity, 0);
  const categories = ['All', ...Array.from(new Set(drinkList.map(d => d.category)))];

  // Orders filtered by search, date, etc.
 const filteredOrders = orders.filter(order => {
  const orderDate = order.timestamp?.toDate?.();
  if (!orderDate) return false;

  // Create proper range
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

  const matchesStart = !start || orderDate >= start;
  const matchesEnd = !end || orderDate <= end;

  // Search filter
  const str = `${order.tableNumber || ''} ${order.items?.map(i => i.name).join(' ') || ''}`.toLowerCase();
  const matchesSearch = str.includes(searchTerm.toLowerCase());

  return matchesStart && matchesEnd && matchesSearch;
});


  const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0);

  // Admin login/logout
  const loginAdmin = () => {
    if (adminPasswordInput === adminPassword) {
      setAuthenticated(true);
      setShowAdminLogin(false);
      setActiveTab('admin');
    } else {
      alert('Incorrect password');
    }
  };

  const logoutAdmin = () => {
    setAuthenticated(false);
    setShowAdminLogin(false);
    setAdminPasswordInput('');
    setActiveTab('drinks');
  };

  // Handle order submission
  const handleSubmitOrder = () => {
    if (!tableNumber) return alert('Please select table number');
    if (cart.length === 0) return alert('Cart is empty');
    setShowPaymentModal(true);
  };

  // Confirm payment and submit order
  const confirmPaymentAndSubmit = async () => {
    if (isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      if (!tableNumber || cart.length === 0) {
        alert('Please select a table and add items to your cart.');
        return;
      }

      const clonedCart = cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image || ''
      }));

      const orderData = {
        items: clonedCart,
        tableNumber: tableNumber,
        total: getTotal(),
        status: 'unpaid',
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, 'orders'), orderData);

      // Cleanup
      setCart([]);
      setTableNumber('');
      setShowPaymentModal(false);
      setPaymentConfirmed(true);
    } catch (error) {
      console.error('Error submitting order:', error);
      alert('Error submitting order. Please try again.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Toggle bar visibility setting in Firestore
  const toggleVisibility = async () => {
    try {
      const docRef = doc(db, 'settings', 'visibility');
      await setDoc(docRef, { isVisible: !isVisible });
      setIsVisible(!isVisible);
    } catch (err) {
      console.error('Failed to toggle visibility:', err);
    }
  };

 const exportToCSV = () => {
  let csvContent = 'Time,Table,Status,Drink,Qty,Price,Subtotal\n';

  const batches = filteredOrders.reduce((acc, order) => {
    const key = order.batchId || order.id;
    if (!acc[key]) {
      acc[key] = {
        table: order.tableNumber,
        timestamp: order.timestamp?.toDate?.().toLocaleString?.() || '',
        status: order.status || 'unknown',
        items: [],
      };
    }
    acc[key].items.push(...order.items);
    return acc;
  }, {});

  Object.values(batches).forEach(batch => {
    batch.items.forEach(item => {
      csvContent += `"${batch.timestamp}","Table ${batch.table}","${batch.status}","${item.name}",${item.quantity},"¥${item.price}","¥${item.price * item.quantity}"\n`;
    });
    // Add an empty row between batches
    csvContent += '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'blackout_batches.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

  // Export orders to PDF
const exportToPDF = () => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'A4' });
  doc.setFontSize(18);
  doc.text('BLACKOUT BAR - Order Batches', 40, 40);

  const batches = filteredOrders.reduce((acc, order) => {
    const key = order.batchId || order.id;
    if (!acc[key]) {
      acc[key] = {
        table: order.tableNumber,
        timestamp: order.timestamp?.toDate?.().toLocaleString?.() || '',
        status: order.status || 'unknown',
        total: order.total || 0,
        items: [],
      };
    }
    acc[key].items.push(...order.items);
    return acc;
  }, {});

  let currentY = 60; // Start position

  Object.values(batches).forEach((batch, index) => {
    // Check if there’s enough space for header + table, else add new page
    if (currentY > doc.internal.pageSize.height - 120) {
      doc.addPage();
      currentY = 40;
    }

    // Add batch header
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text(
      `Table ${batch.table} — ${batch.timestamp} — ${batch.status.toUpperCase()} — Total: ¥${batch.total}`,
      40,
      currentY
    );
    currentY += 15;

    const rows = batch.items.map(item => [
      item.name,
      item.quantity,
      `¥${item.price}`,
      `¥${item.price * item.quantity}`,
    ]);

    if (rows.length > 0) {
      // Draw the table
      autoTable(doc, {
        startY: currentY,
        head: [['Drink', 'Qty', 'Price', 'Subtotal']],
        body: rows,
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [0, 0, 0] },
        margin: { left: 40, right: 40 },
        didDrawPage: (data) => {
          // When a new page is created, reset currentY
          currentY = data.cursor.y + 20;
        },
      });

      // Update currentY after table
      currentY = doc.lastAutoTable?.finalY + 30 || currentY + 30;
    } else {
      currentY += 30; // Empty batch, just add spacing
    }
  });

  if (Object.keys(batches).length === 0) {
    alert('No orders to export.');
    return;
  }

  doc.save('blackout_batches.pdf');
};


  // Save payment QR code URL to Firestore
  const savePaymentQRUrl = async () => {
    if (!adminQRInput) {
      alert('QR code URL cannot be empty.');
      return;
    }
    try {
      const qrDocRef = doc(db, 'settings', 'paymentQR');
      await setDoc(qrDocRef, { url: adminQRInput });
      setPaymentQRUrl(adminQRInput);
      alert('Payment QR code updated successfully!');
    } catch (err) {
      console.error('Failed to save payment QR code URL:', err);
      alert('Failed to update payment QR code.');
    }
  };

  // Clear all orders in a group
  const clearOrderGroup = async (groupItems) => {
    if (!window.confirm('Are you sure you want to clear this order group?')) return;

    try {
      await Promise.all(
        groupItems.map(order => deleteDoc(doc(db, 'orders', order.id)))
      );
      alert('Order group cleared!');
    } catch (err) {
      console.error('Error clearing order group:', err);
      alert('Failed to clear order group.');
    }
  };

 
  // Filter drinks by category
  const filteredDrinks = selectedCategory === 'All'
    ? drinkList
    : drinkList.filter(d => d.category === selectedCategory);

  return (
    <div className="App">
      {/* Welcome message overlay */}
      {showWelcome && (
        <div
          className="welcome-overlay"
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: '#ffd700',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            fontSize: '2rem',
            fontWeight: 'bold',
            userSelect: 'none',
            flexDirection: 'column',
            padding: '1rem',
            textAlign: 'center',
          }}
          onClick={() => setShowWelcome(false)}
        >
          <p>Welcome to BLACKOUT BAR 🍸</p>
          <small style={{ fontSize: '1rem', marginTop: '1rem', color: '#ccc' }}>
            Tap anywhere to continue
          </small>
        </div>
      )}

      <h1 className="app-title">BLACKOUT BAR</h1>

     {/* Drinks tab */}
      {activeTab === 'drinks' && (
        <>
          <div className="category-buttons-container">
            {categories.map(cat => (
              <button
                key={cat}
                className={`category-button ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  backgroundColor: selectedCategory === cat 
                    ? '#ffd700' 
                    : 'rgba(255,255,255,0.1)',
                  color: selectedCategory === cat 
                    ? '#000000' 
                    : 'rgba(255,255,255,0.8)',
                  fontSize: '0.85rem',
                  fontWeight: '400',
                  letterSpacing: '0.2px',
                  transition: 'all 0.3s ease',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '20px',
                  border: 'none'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
          <div
            className="drink-grid"
            style={{ paddingBottom: cart.length > 0 ? '80px' : undefined }}
          >
            {filteredDrinks.map(drink => (
              <div className="drink-card" key={drink.id}>
                {drink.image && (
                  <img src={drink.image} alt={drink.name} className="drink-img" />
                )}
                <h3 style={{
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  letterSpacing: '0.2px',
                  marginBottom: '0.4rem'
                }}>{drink.name}</h3>
                <p style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '0.8rem',
                  fontWeight: '300',
                  lineHeight: '1.3',
                  letterSpacing: '0.2px'
                }}>{drink.description}</p>
                <p style={{
                  color: '#ffd700',
                  fontSize: '0.9rem',
                  fontWeight: '400',
                  letterSpacing: '0.3px'
                }}>¥{drink.price.toLocaleString()}</p>
                <button
                  onClick={() => addToCart(drink)}
                  className={`add-btn ${addedItemIds.includes(drink.id) ? 'added' : ''}`}
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: '400',
                    letterSpacing: '0.2px'
                  }}
                >
                  {addedItemIds.includes(drink.id) ? '✅ Added!' : 'Add to Cart'}
                </button>
              </div>
            ))}
          </div>

          {cart.length > 0 && (
            <div className="bottom-bar">
              <button 
                onClick={() => setActiveTab('cart')}
                style={{
                  fontSize: '0.9rem',
                  fontWeight: '400',
                  letterSpacing: '0.2px',
                  color: '#1a1a1a'
                }}
              >
                Order Now ({totalItemsInCart} {totalItemsInCart === 1 ? 'item' : 'items'})
              </button>
            </div>
          )}
        </>
      )}
      {/* Cart tab */}
      {activeTab === 'cart' && (
        <div style={{ padding: '1rem' }}>
          <h2 style={{ 
            color: '#ffd700',
            fontSize: '1.8rem',
            textAlign: 'center',
            marginBottom: '1.5rem',
            textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
          }}>Your Cart</h2>
          
          {cart.length === 0 ? (
            <div style={{ 
              textAlign: 'center',
              padding: '2rem',
              color: '#fff',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '10px',
              margin: '1rem 0'
            }}>
              <span style={{ fontSize: '2rem' }}>🛒</span>
              <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>Your cart is empty</p>
            </div>
          ) : (
            <ul className="cart-list" style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '15px',
              overflow: 'hidden'
            }}>
              {cart.map(item => (
                <li key={item.id} style={{
                  display: 'flex',
                  padding: '1rem',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  margin: '0.5rem',
                  borderRadius: '12px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                  {item.image && (
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      style={{
                        width: '80px',
                        height: '80px',
                        objectFit: 'cover',
                        borderRadius: '10px',
                        marginRight: '1rem'
                      }}
                    />
                  )}
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <h3 style={{
                        color: '#fff',
                        margin: '0 0 0.5rem 0',
                        fontSize: '1.2rem'
                      }}>{item.name}</h3>
                      <div style={{
                        color: '#ffd700',
                        fontSize: '1.1rem',
                        fontWeight: 'bold'
                      }}>
                        ¥{item.price} × {item.quantity} = ¥{item.price * item.quantity}
                      </div>
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginTop: '1rem',
                      gap: '0.5rem'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        borderRadius: '25px',
                        padding: '0.25rem'
                      }}>
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          style={{
                            width: '35px',
                            height: '35px',
                            borderRadius: '50%',
                            border: 'none',
                            backgroundColor: '#ff4757',
                            color: 'white',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'transform 0.2s'
                          }}
                        >-</button>
                        <span style={{
                          padding: '0 1rem',
                          color: '#fff',
                          fontSize: '1.2rem',
                          fontWeight: 'bold',
                          minWidth: '40px',
                          textAlign: 'center'
                        }}>{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          style={{
                            width: '35px',
                            height: '35px',
                            borderRadius: '50%',
                            border: 'none',
                            backgroundColor: '#2ecc71',
                            color: 'white',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'transform 0.2s'
                          }}
                        >+</button>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        style={{
                          width: '35px',
                          height: '35px',
                          borderRadius: '50%',
                          border: 'none',
                          backgroundColor: '#e74c3c',
                          color: 'white',
                          fontSize: '1.2rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'transform 0.2s'
                        }}
                      >×</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div style={{
            backgroundColor: 'rgba(0,0,0,0.3)',
            padding: '1rem',
            borderRadius: '12px',
            margin: '1.5rem 0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{
              color: '#ffd700',
              fontSize: '1.4rem',
              textAlign: 'center',
              margin: '0'
            }}>Total: ¥{getTotal().toLocaleString()}</h3>
          </div>

          {cart.length > 0 && (
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              padding: '1.5rem',
              borderRadius: '15px',
              marginTop: '1.5rem'
            }}>
              <h3 style={{
                color: '#fff',
                textAlign: 'center',
                marginBottom: '1rem',
                fontSize: '1.2rem'
              }}>Confirm Table Number</h3>
              
              <select
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  borderRadius: '10px',
                  border: '2px solid rgba(255,215,0,0.3)',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  color: '#fff',
                  fontSize: '1.1rem',
                  marginBottom: '1rem',
                  appearance: 'none',
                  textAlign: 'center'
                }}
              >
                <option value="">Select Table</option>
                {Array.from({ length: 100 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Table {i + 1}</option>
                ))}
              </select>

              <button
                onClick={handleSubmitOrder}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#ffd700',
                  color: '#000',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, background-color 0.2s',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <span>Submit Order</span>
                <span style={{ fontSize: '1.4rem' }}>→</span>
              </button>
            </div>
          )}
        </div>
      )}
      {/* Payment Modal */}
      {showPaymentModal && (
        <div
          className="payment-modal-overlay"
          onClick={() => !isSubmitting && setShowPaymentModal(false)}
        >
          <div className="payment-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="payment-title">Please complete your payment</h3>
            <p className="payment-instruction">Scan this QR code to pay:</p>

            {paymentQRUrl ? (
              <img
                src={paymentQRUrl}
                alt="Payment QR Code"
                className="payment-qr"
              />
            ) : (
              <p style={{ color: '#fff' }}>No payment QR code available.</p>
            )}

            <button
              className="payment-confirm-btn"
              onClick={confirmPaymentAndSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing…' : '✅ I Have Paid'}
            </button>
            <button
              className="payment-cancel-btn"
              onClick={() => !isSubmitting && setShowPaymentModal(false)}
              disabled={isSubmitting}
            >
              ❌ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Payment confirmation overlay */}
      {paymentConfirmed && (
        <div
          className="payment-confirmed-overlay"
          onClick={() => setPaymentConfirmed(false)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: '#fff',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            textAlign: 'center',
            padding: '1rem'
          }}
        >
          <div>
            <h2 style={{ color: '#00ff99' }}>✅ Order Submitted!</h2>
            <p>Thank you. Your drinks will arrive shortly.</p>
            <button
              onClick={() => setPaymentConfirmed(false)}
              style={{
                marginTop: '1rem',
                padding: '10px 20px',
                borderRadius: '8px',
                backgroundColor: '#ffd700',
                color: '#000',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Admin tab content */}
      {activeTab === 'admin' && !authenticated && showAdminLogin && (
        <div
          className="admin-login"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#111',
              padding: '1rem 1.5rem',
              borderRadius: '12px',
              width: '85vw',
              maxWidth: '280px',
              textAlign: 'center',
            }}
          >
            <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Admin Login</h3>
            <input
              type="password"
              placeholder="Password"
              value={adminPasswordInput}
              onChange={e => setAdminPasswordInput(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #ccc',
                marginBottom: '1rem',
                color: '#000',
                backgroundColor: '#fff',
                fontWeight: 'normal',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <button onClick={loginAdmin} style={{ padding: '0.5rem 1rem' }}>Login</button>
              <button onClick={() => setShowAdminLogin(false)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

     {authenticated && activeTab === 'admin' && (
  <div className="admin-panel" style={{ padding: '1rem' }}>
    <h2>Admin Panel</h2>

    {/* Toggle Buttons */}
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
      <button
        onClick={() => {
          setShowSavedDrinks(false);
        }}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: !showSavedDrinks ? '#222' : '#ddd',
          color: !showSavedDrinks ? '#fff' : '#000',
          borderRadius: '8px',
        }}
      >
        Main Dashboard
      </button>
      <button
        onClick={() => {
          setShowSavedDrinks(true);
          fetchSavedDrinks(); // Load saved drinks on click
        }}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: showSavedDrinks ? '#222' : '#ddd',
          color: showSavedDrinks ? '#fff' : '#000',
          borderRadius: '8px',
        }}
      >
        Saved Drinks
      </button>
    </div>

    {/* ===== MAIN DASHBOARD ===== */}
    {!showSavedDrinks && (
      <>
        {/* Search bar */}
        <input
          type="text"
          placeholder="Search orders..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            marginBottom: '0.5rem',
            borderRadius: '8px',
          }}
        />

        {/* Date filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '6px' }}
          />
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '6px' }}
          />
        </div>

        {/* Utility buttons */}
        <button onClick={toggleVisibility} style={{ marginRight: '0.5rem' }}>
          {isVisible ? 'Hide Bar' : 'Show Bar'}
        </button>
        <button onClick={exportToPDF} style={{ marginRight: '0.5rem' }}>
          Export PDF
        </button>
        <button onClick={exportToCSV}>Export CSV</button>

        {/* Order Stats */}
        <h3
          style={{
            marginTop: '2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <span>Order Batches ({filteredOrders.length})</span>
          <span>
            <strong>Total Drinks:</strong>{' '}
            {filteredOrders.reduce((sum, order) => {
              if (!order.items) return sum;
              return (
                sum +
                order.items.reduce((subSum, item) => subSum + item.quantity, 0)
              );
            }, 0)}
          </span>
          <span>
            <strong>Total Revenue:</strong> ¥{totalRevenue}
          </span>
        </h3>

        {/* Order List */}
        {filteredOrders.length === 0 && <p>No orders found.</p>}

        {Object.values(
          filteredOrders.reduce((batches, order) => {
            if (!order || !order.items || order.items.length === 0) return batches;
            const batchKey = order.batchId || order.id;
            if (!batches[batchKey]) {
              batches[batchKey] = {
                table: order.tableNumber,
                batchId: order.batchId,
                timestamp: order.timestamp,
                status: order.status,
                items: [],
                orders: [],
                total: 0,
              };
            }
            batches[batchKey].items.push(...order.items);
            batches[batchKey].total += order.total || 0;
            batches[batchKey].orders.push(order);
            return batches;
          }, {})
        ).map(batch => {
          const timeStr =
            batch.timestamp?.toDate?.()?.toLocaleTimeString?.() || '';

          return (
            <div
              key={batch.batchId}
              style={{
                marginBottom: '1.5rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                padding: '0.5rem',
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <h4 style={{ margin: 0 }}>
                  Table {batch.table} — Total: ¥{batch.total}{' '}
                  {timeStr && (
                    <small
                      style={{ fontWeight: 'normal', color: '#666' }}
                    >
                      at {timeStr}
                    </small>
                  )}
                </h4>
                <span
                  style={{
                    color: batch.status === 'unpaid' ? 'red' : 'green',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                  }}
                >
                  {batch.status === 'unpaid' ? '❌ Unpaid' : '✅ Paid'}
                </span>
              </div>

              {/* Order Items */}
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  marginTop: '0.5rem',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid #aaa' }}>
                    <th style={{ textAlign: 'left', padding: '4px' }}>Drink</th>
                    <th style={{ textAlign: 'center', padding: '4px' }}>
                      Qty
                    </th>
                    <th style={{ textAlign: 'right', padding: '4px' }}>
                      Price
                    </th>
                    <th style={{ textAlign: 'right', padding: '4px' }}>
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {batch.items.map((item, index) => (
                    <tr
                      key={index}
                      style={{ borderBottom: '1px solid #eee' }}
                    >
                      <td style={{ padding: '4px' }}>{item.name}</td>
                      <td
                        style={{
                          textAlign: 'center',
                          padding: '4px',
                        }}
                      >
                        {item.quantity}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          padding: '4px',
                        }}
                      >
                        ¥{item.price}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          padding: '4px',
                        }}
                      >
                        ¥{item.price * item.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                onClick={() => clearOrderGroup(batch.orders)}
                style={{
                  marginTop: '8px',
                  backgroundColor: 'green',
                  color: 'white',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                ✅ Mark Batch as Served (Clear Orders)
              </button>
            </div>
          );
        })}

        {/* Logout */}
        <button
          onClick={logoutAdmin}
          style={{
            marginTop: '2rem',
            backgroundColor: 'red',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '8px',
          }}
        >
          Logout Admin
        </button>
      </>
    )}

    {/* ===== SAVED DRINKS TAB ===== */}
    {showSavedDrinks && (
      <div>
        <h3>Saved Unfinished Drinks</h3>

        {/* Save Drinks Form */}
        <input
          type="text"
          placeholder="Enter Customer Phone Number"
          value={customerPhone}
          onChange={e => setCustomerPhone(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            margin: '0.5rem 0',
            borderRadius: '8px',
          }}
        />
        <textarea
          placeholder="Enter Drinks (name, qty, special notes)"
          value={savedDrinksInput}
          onChange={e => setSavedDrinksInput(e.target.value)}
          style={{
            width: '100%',
            height: '100px',
            padding: '0.5rem',
            margin: '0.5rem 0',
            borderRadius: '8px',
          }}
        ></textarea>
        <button
          onClick={saveCustomerDrinks}
          style={{
            backgroundColor: 'green',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            marginBottom: '1rem',
          }}
        >
          💾 Save Drinks
        </button>

        {/* Display Saved Drinks */}
        <h4>Previously Saved Drinks</h4>
        {savedDrinksList.length === 0 ? (
          <p>No saved drinks found.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {savedDrinksList.map((entry, index) => (
              <li
                key={entry.id}
                style={{
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  padding: '0.5rem',
                  marginBottom: '0.5rem',
                }}
              >
                <strong>{entry.phone}</strong>: {entry.drinks}
                <button
                  onClick={() => deleteSavedDrink(entry.id)}
                  style={{
                    marginLeft: '1rem',
                    backgroundColor: 'red',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )}
  </div>
)}






      {/* Navigation bottom tab */}
      <nav className="bottom-nav">
        <button
          className={activeTab === 'drinks' ? 'active' : ''}
          onClick={() => setActiveTab('drinks')}
        >
          Drinks
        </button>
        <button
          className={activeTab === 'cart' ? 'active' : ''}
          onClick={() => setActiveTab('cart')}
        >
          Cart ({totalItemsInCart})
        </button>
        {!authenticated ? (
          <button onClick={() => {
            setActiveTab('admin');
            setShowAdminLogin(true);
          }}>
            Admin
          </button>
        ) : (
          <button onClick={() => setActiveTab('admin')}>
            Dashboard
          </button>
        )}
      </nav>
    </div>
  );
}

export default App;
