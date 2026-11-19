import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dropDatabase} from './e2e-database.mjs';
for(const name of ['hotel_dev','hotel_test','hotel_e2e_shared','hotel_e2e_abc; DROP DATABASE hotel_dev'])test('refuses cleanup of '+name,async()=>{
 await assert.rejects(dropDatabase(name),/Refusing to drop/);
});
