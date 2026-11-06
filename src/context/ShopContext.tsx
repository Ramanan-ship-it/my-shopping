import React, { createContext, useContext, useState, useEffect } from 'react';
import { Shop } from '../types';
import { useAuth } from './AuthContext';

interface ShopContextType {
  activeShop: string; // 'all' | 'shop_retail' | 'shop_wholesale'
  setActiveShop: (shopId: string) => void;
  shops: Shop[];
  activeShopDetails: Shop | null;
  currency: string;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const DEFAULT_SHOPS: Shop[] = [
  {
    id: 'shop_retail',
    name: 'Smart Dress Shop - Retail',
    code: 'RET',
    type: 'retail',
    address: '142 Bazaar Street, Commercial Complex, Chennai, TN',
    phone: '+91 98765 43210',
    email: 'retail@smartdress.com',
    gstin: '33AABCS1429B1Z1',
  },
  {
    id: 'shop_wholesale',
    name: 'Smart Dress Shop - Wholesale',
    code: 'WHO',
    type: 'wholesale',
    address: '88 Textile Market Road, Goods Hub, Chennai, TN',
    phone: '+91 98765 43211',
    email: 'wholesale@smartdress.com',
    gstin: '33AABCS1429B2Z2',
  },
];

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeShop, setActiveShopState] = useState<string>('shop_retail');
  const [currency] = useState<string>('₹');

  // Sync activeShop with user's assigned_shop upon login
  useEffect(() => {
    if (user) {
      if (user.assigned_shop === 'retail') {
        setActiveShopState('shop_retail');
      } else if (user.assigned_shop === 'wholesale') {
        setActiveShopState('shop_wholesale');
      } else {
        // Owner or user with 'all'
        // keep current selection if valid, or default to retail
        if (!['shop_retail', 'shop_wholesale', 'all'].includes(activeShop)) {
          setActiveShopState('shop_retail');
        }
      }
    }
  }, [user]);

  const setActiveShop = (shopId: string) => {
    if (user && user.assigned_shop !== 'all' && user.role !== 'OWNER') {
      const allowed =
        (user.assigned_shop === 'retail' && (shopId === 'shop_retail' || shopId === 'retail')) ||
        (user.assigned_shop === 'wholesale' && (shopId === 'shop_wholesale' || shopId === 'wholesale'));
      if (!allowed) {
        return; // ignore unauthorized shop change
      }
    }
    setActiveShopState(shopId);
  };

  const activeShopDetails = DEFAULT_SHOPS.find(s => s.id === activeShop) || null;

  return (
    <ShopContext.Provider
      value={{
        activeShop,
        setActiveShop,
        shops: DEFAULT_SHOPS,
        activeShopDetails,
        currency,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
};
