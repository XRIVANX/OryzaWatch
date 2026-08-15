import React from 'react';
import LoginForm from '../../components/auth/LoginForm';
import type { User } from '../../types';

interface AuthViewProps {
  onLoginSuccess: (user: User) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  return <LoginForm onLoginSuccess={onLoginSuccess} />;
};

export default AuthView;
