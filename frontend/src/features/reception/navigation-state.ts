import { useLocation, useNavigate } from 'react-router';

export function useDeskOrigin() {
  const { pathname, search, hash } = useLocation();
  return { deskOrigin: pathname + search + hash };
}

export function useDeskNavigate() {
  const navigate = useNavigate();
  const origin = useDeskOrigin();
  return (to: string) => navigate(to, { state: origin });
}
