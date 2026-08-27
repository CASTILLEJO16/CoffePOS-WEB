import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { DevAuthProvider, useDevAuth } from './context/DevAuthContext.jsx';
import Licencias from './pages/Licencias.jsx';
import DevLogin from './pages/DevLogin.jsx';
import './styles/global.css';

function DevProtectedRoute({ children }) {
  const { isAuthenticated } = useDevAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <ThemeProvider>
      <DevAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<DevLogin />} />
            <Route
              path="/"
              element={
                <DevProtectedRoute>
                  <Licencias />
                </DevProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </DevAuthProvider>
    </ThemeProvider>
  );
}

export default App;
