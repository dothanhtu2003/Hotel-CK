import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { SearchForm } from './components';
afterEach(cleanup);
function Location() { const l = useLocation(); return <output>{l.pathname + l.search}</output>; }
it('search form blocks equal dates then navigates with validated filters', async () => {
  render(<MemoryRouter><SearchForm /><Location /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('NGÀY NHẬN PHÒNG'), { target: { value: '2027-12-01' } });
  fireEvent.change(screen.getByLabelText('NGÀY TRẢ PHÒNG'), { target: { value: '2027-12-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tìm phòng' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('phải sau'));
  fireEvent.change(screen.getByLabelText('NGÀY TRẢ PHÒNG'), { target: { value: '2027-12-04' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tìm phòng' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('/rooms?checkIn=2027-12-01&checkOut=2027-12-04&guests=2'));
});
