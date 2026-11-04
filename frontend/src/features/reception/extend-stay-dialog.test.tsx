import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { ExtendStayDialog } from './extend-stay-dialog';
import { api } from '../../lib/api';
import type { DeskBooking } from './contracts';
import { hotelToday, shiftDate } from './room-state';
const booking = { id:'b1',roomNumber:'311',roomId:'old',checkOut:shiftDate(hotelToday(),-4),customer:{fullName:'Đỗ Hoàng Nam'} } as DeskBooking;
const quote = {quoteToken:'a'.repeat(64),checkOut:shiftDate(hotelToday(),1),expectedCheckOut:booking.checkOut,transferDate:hotelToday(),currentRoomId:'old',currentRoomNumber:'311',conflict:{reference:'BK-B',checkIn:hotelToday(),checkOut:shiftDate(hotelToday(),3)},rooms:[{id:'new',roomNumber:'312',roomType:'Standard',sameType:true,capacity:2,nightlyPrice:'1000'}],overdueNights:4,extensionNights:1,overdueAmount:'4000',extensionAmount:'1000',priceDifference:'0',additionalAmount:'5000',totalRoomAmount:'6000',paidAmount:'1000',balance:'5000'};
beforeEach(()=>{HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function mount(){const closed=vi.fn();render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ExtendStayDialog booking={booking} onClose={closed}/></QueryClientProvider></MemoryRouter>);return closed;}
it('requires an alternative and explicit cost confirmation before transferring',async()=>{
 const request=vi.spyOn(api,'request').mockImplementation(async path=>path.endsWith('/extension-preview')?quote:{});const closed=mount();
 fireEvent.click(screen.getByRole('button',{name:'Kiểm tra phòng'}));
 expect(await screen.findByText(/Cần chuyển phòng/)).toBeTruthy();
 const confirm=screen.getByRole('button',{name:'Xác nhận chuyển phòng & gia hạn'}) as HTMLButtonElement;expect(confirm.disabled).toBe(true);
 fireEvent.click(screen.getByRole('radio'));expect(screen.getByText('Tiền quá hạn · 4 đêm')).toBeTruthy();expect(screen.getByText('Tiền gia hạn · 1 đêm')).toBeTruthy();expect(screen.getByText('Tiền phòng đã thanh toán')).toBeTruthy();expect(confirm.disabled).toBe(true);
 fireEvent.click(screen.getByRole('checkbox',{name:'Xác nhận phương án gia hạn'}));fireEvent.click(confirm);
 await vi.waitFor(()=>expect(closed).toHaveBeenCalledTimes(1));
 expect(request).toHaveBeenCalledWith('/bookings/b1/extend',expect.objectContaining({body:expect.objectContaining({targetRoomId:'new',quoteToken:quote.quoteToken,expectedCheckOut:booking.checkOut,requestId:expect.any(String)})}));
});
it('blocks extension when no suitable alternative remains',async()=>{
 vi.spyOn(api,'request').mockResolvedValue({...quote,rooms:[]});mount();fireEvent.click(screen.getByRole('button',{name:'Kiểm tra phòng'}));
 expect(await screen.findByText('Không còn phòng trống phù hợp')).toBeTruthy();expect((screen.getByRole('button',{name:'Xác nhận chuyển phòng & gia hạn'}) as HTMLButtonElement).disabled).toBe(true);expect(screen.queryByRole('checkbox')).toBeNull();
});
it('keeps the room when there is no conflict and clears the quote if the date changes',async()=>{
 vi.spyOn(api,'request').mockResolvedValue({...quote,conflict:null,rooms:[]});mount();fireEvent.click(screen.getByRole('button',{name:'Kiểm tra phòng'}));
 expect(await screen.findByText('Phòng 311 còn trống, có thể ở tiếp.')).toBeTruthy();expect(screen.getByRole('button',{name:'Xác nhận gia hạn'})).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Ngày trả mới'),{target:{value:shiftDate(hotelToday(),2)}});expect(screen.queryByRole('button',{name:'Xác nhận gia hạn'})).toBeNull();
});
