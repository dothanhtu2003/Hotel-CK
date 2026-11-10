import { test, expect } from '@playwright/test';
import { login } from './fixtures';

test('QA mobile home and booking cards fit narrow and desktop viewports',async({page})=>{
  await page.goto('/');
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await login(page);
  await page.evaluate(()=>{history.pushState({},'','/guest/bookings');dispatchEvent(new PopStateEvent('popstate'));});
  await expect(page.getByRole('heading',{name:'Booking của tôi',exact:true})).toBeVisible();
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});

test('QA persistent session restores and a real authenticated 401 clears storage',async({page,context})=>{
  await login(page);
  expect(await page.evaluate(()=>{
    const saved=localStorage.getItem('an-nhien.auth-session');
    return !!saved&&typeof JSON.parse(saved).accessToken==='string';
  })).toBe(true);
  await page.reload();
  await expect(page.getByRole('button',{name:'Đăng nhập',exact:true})).toHaveCount(0);
  await context.route('**/api/bookings/my**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"message":"Unauthorized"}'}));
  await page.evaluate(()=>{history.pushState({},'','/guest/bookings');dispatchEvent(new PopStateEvent('popstate'));});
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(()=>localStorage.getItem('an-nhien.auth-session'))).toBeNull();
});
