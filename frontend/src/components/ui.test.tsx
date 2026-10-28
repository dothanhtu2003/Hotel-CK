import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Button, EmptyState, Pagination, Table } from './ui';
afterEach(cleanup);
describe('Reusable UI interaction boundaries', () => {
  it('busy buttons cannot submit twice', () => { const click = vi.fn(); render(<Button busy onClick={click}>Lưu</Button>); const button = screen.getByRole('button'); expect(button.hasAttribute('disabled')).toBe(true); fireEvent.click(button); expect(click).not.toHaveBeenCalled(); });
  it('table supplies an explicit empty state without fake records', () => { render(<Table columns={[]} rows={[]} rowKey={() => ''} caption="Phòng" empty={<EmptyState title="Chưa có dữ liệu" description="Chưa có bản ghi." />} />); expect(screen.getByText('Chưa có dữ liệu')).toBeTruthy(); expect(screen.queryByRole('table')).toBeNull(); });
  it('pagination respects the first and last page', () => { const change = vi.fn(); const view = render(<Pagination page={1} pageSize={10} total={20} onChange={change} />); expect(screen.getByRole('button', { name: 'Trang trước' }).hasAttribute('disabled')).toBe(true); fireEvent.click(screen.getByRole('button', { name: 'Trang sau' })); expect(change).toHaveBeenCalledWith(2); view.rerender(<Pagination page={2} pageSize={10} total={20} onChange={change} />); expect(screen.getByRole('button', { name: 'Trang sau' }).hasAttribute('disabled')).toBe(true); });
});
