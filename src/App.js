import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import './App.css';

function App() {
  const [drinks, setDrinks] = useState([]);
  const [cart, setCart] = useState([]);
  const [tab, setTab] = useState('drinks');

  useEffect(() => {
    Papa.parse("https://docs.google.com/spreadsheets/d/e/2PACX-1vQyZEDaYEI3m_--c6sPIH7cz9a4UtVK4eXFXFUrhRhDffm-UPQ6oOiC1pYnvPxdqvuOEoTsoVoDIh3X/pub?output=csv", {
      download: true,
      header: true,
      complete: (result) => {
        const parsed = result.data
          .filter(d => d.name && d.price)
          .map((item, index) => ({
            ...item,
            price: parseFloat(item.price),
            id: parseInt(item.id) || index,
          }));
        setDrinks(parsed);
      },
    });
  }, []);

  const addToCart = (drink) => {
    setCart(prev => {
      const existing = prev.find(d => d.id === drink.id);
      if (existing) {
        return prev.map(d =>
          d.id === drink.id ? { ...d, quantity: d.quantity + 1 } : d
        );
      } else {
        return [...prev, { ...drink, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const changeQuantity = (id, delta) => {
    setCart(prev =>
      prev.map(item =>
        item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      )
    );
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const renderDrinks = () => (
    <div className="container">
      <h1>Drinks</h1>
      {drinks.map(drink => (
        <div className="drink" key={drink.id}>
          <img src={drink.image} alt={drink.name} />
          <div className="drink-info">
            <h3>{drink.name}</h3>
            <p>{drink.description}</p>
            <p>¥{drink.price}</p>
            <button onClick={() => addToCart(drink)}>Add to Cart</button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderCart = () => (
    <div className="container">
      <h1>Your Cart</h1>
      {cart.length === 0 ? (
        <p>No items in cart.</p>
      ) : (
        <>
          {cart.map(item => (
            <div className="cart-item" key={item.id}>
              <img src={item.image} alt={item.name} style={{ width: 60, height: 60, objectFit: 'cover', marginRight: 10 }} />
              <div style={{ flexGrow: 1 }}>
                <strong>{item.name}</strong><br />
                ¥{item.price} × {item.quantity}
              </div>
              <span>
                <button onClick={() => changeQuantity(item.id, -1)}>-</button>
                <button onClick={() => changeQuantity(item.id, 1)}>+</button>
                <button onClick={() => removeFromCart(item.id)}>🗑</button>
              </span>
            </div>
          ))}
          <h2>Total: ¥{total.toFixed(2)}</h2>
        </>
      )}
    </div>
  );

  const renderCategories = () => (
    <div className="container">
      <h1>Categories</h1>
      <p>This section is for future filtering by drink types (Cocktails, Soft Drinks, etc.).</p>
    </div>
  );

  return (
    <div>
      <nav style={{ background: '#FFD700', padding: 10, display: 'flex', justifyContent: 'space-around' }}>
        <button onClick={() => setTab('drinks')}>Drinks</button>
        <button onClick={() => setTab('cart')}>Cart</button>
        <button onClick={() => setTab('categories')}>Categories</button>
      </nav>

      {tab === 'drinks' && renderDrinks()}
      {tab === 'cart' && renderCart()}
      {tab === 'categories' && renderCategories()}
    </div>
  );
}

export default App;
