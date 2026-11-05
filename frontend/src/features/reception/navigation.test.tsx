import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, it } from 'vitest';
import { DeskBackLink, DeskLink, DeskLinkButton } from './navigation';

it('returns through each source entry and preserves the original filters', async () => {
  const cashier = '/reception/billing?group=outstanding&page=2';
  const bookingBilling = '/reception/bookings/b1/billing';
  const invoice = '/reception/invoices/i1';
  render(
    <MemoryRouter initialEntries={[cashier]}>
      <Routes>
        <Route path="/reception/billing" element={<DeskLinkButton to={bookingBilling}>Chi phí booking</DeskLinkButton>} />
        <Route path={bookingBilling} element={
          <>
            <DeskBackLink to="/reception/bookings">Danh sách booking</DeskBackLink>
            <DeskLink to={invoice}>Hóa đơn</DeskLink>
          </>
        } />
        <Route path={invoice} element={<DeskBackLink to="/reception/invoices">Danh sách hóa đơn</DeskBackLink>} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('link', { name: 'Chi phí booking' }));
  fireEvent.click(await screen.findByRole('link', { name: 'Hóa đơn' }));
  const invoiceBack = await screen.findByRole('link', { name: 'Quay lại' });
  expect(invoiceBack.getAttribute('href')).toBe(bookingBilling);
  fireEvent.click(invoiceBack);
  const bookingBack = await screen.findByRole('link', { name: 'Quay lại' });
  expect(bookingBack.getAttribute('href')).toBe(cashier);
  fireEvent.click(bookingBack);
  await screen.findByRole('link', { name: 'Chi phí booking' });
});

it('uses the section fallback when a detail page is opened directly', () => {
  render(
    <MemoryRouter initialEntries={['/reception/service-orders/s1']}>
      <DeskBackLink to="/reception/service-orders">Danh sách đơn dịch vụ</DeskBackLink>
    </MemoryRouter>,
  );

  expect(screen.getByRole('link', { name: 'Danh sách đơn dịch vụ' }).getAttribute('href'))
    .toBe('/reception/service-orders');
});
