

import { expect } from 'expect';
import { describe, it } from 'mocha';
import { getModelResponse } from '../src/Chat';

describe('getChatCompletion', () => {

  it('should successfully return chat completion', async () => {
    const result = await getModelResponse('You are helpful', 'say Hi');
    expect(result).toMatch(/(Hi|Hello)/);
    
  }).timeout(10000);
});