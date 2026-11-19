import { afterEach, expect, it, vi } from 'vitest';
import { act,cleanup,fireEvent,render,screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { ToastContext } from '../components/toast-context';
import { changeLanguage } from '../i18n';
import { ServicesPage } from './service-pages';
vi.mock('../features/guest/queries',()=>({
 useStays:()=>({data:[{id:'stay',status:'CHECKED_IN',roomNumber:'101',reference:'BOOK-UNCHANGED'}],isPending:false}),
 useServices:()=>({data:[{id:'coffee',name:'Cà phê',currentPrice:'45000.25',description:'',isActive:true}],isPending:false}),
}));
afterEach(cleanup);
it('retains invalid fractional quantities without crashing and blocks submission in VI and EN',async()=>{
 render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><ToastContext.Provider value={vi.fn()}><ServicesPage/></ToastContext.Provider></QueryClientProvider></MemoryRouter>);
 const quantity=screen.getByLabelText('Số lượng Cà phê');fireEvent.change(quantity,{target:{value:'1.5'}});
 expect((screen.getByRole('button',{name:'Xem lại đơn dịch vụ'}) as HTMLButtonElement).disabled).toBe(true);expect((quantity as HTMLInputElement).value).toBe('1.5');
 await act(()=>changeLanguage('en'));expect((screen.getByRole('button',{name:'Review service order'}) as HTMLButtonElement).disabled).toBe(true);expect((quantity as HTMLInputElement).value).toBe('1.5');
 fireEvent.change(quantity,{target:{value:'2'}});expect((screen.getByRole('button',{name:'Review service order'}) as HTMLButtonElement).disabled).toBe(false);expect(screen.getAllByText('₫90,000.50').length).toBeGreaterThan(0);
});
