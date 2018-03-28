'use strict'

import _ from 'lodash'

function square(n) {
  return n * n;
}
 
console.log('Test #1)', _.map([4, 8], square))
// => [16, 64]
 
console.log('Test #2)', _.map({ 'a': 4, 'b': 8 }, square))
// => [16, 64] (iteration order is not guaranteed)
 
var users = [
  { 'user': 'barney' },
  { 'user': 'fred' }
];
 
// The `_.property` iteratee shorthand.
console.log('Test #3)', _.map(users, 'user'))