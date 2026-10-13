import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user] = useState({ 
    id: 'emp-kitchen', 
    name: 'Kitchen Chef', 
    designation: 'Head Chef', 
    role: 'KITCHEN' 
  });

  const login = () => user;
  const logout = () => {};

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
