import { Route, Routes } from 'react-router-dom';

import { AccountDetailPage } from '@/pages/AccountDetailPage';
import { AccountsPage } from '@/pages/AccountsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AccountsPage />} />
      <Route path="/accounts/:id" element={<AccountDetailPage />} />
      <Route path="*" element={<AccountsPage />} />
    </Routes>
  );
}