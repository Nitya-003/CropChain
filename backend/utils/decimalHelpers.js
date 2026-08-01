const mongoose = require('mongoose');
const Decimal = require('decimal.js');

function toDecimal(value) {
  if (value === null || value === undefined) return new Decimal(0);
  if (value instanceof Decimal) return value;
  if (typeof value === 'object' && value._bsontype === 'Decimal128') {
    return new Decimal(value.toString());
  }
  return new Decimal(value);
}

function fromDecimal(dec) {
  return mongoose.Types.Decimal128.fromString(dec.toString());
}

function fromString(str) {
  return mongoose.Types.Decimal128.fromString(str);
}

function add(a, b) {
  return toDecimal(a).plus(toDecimal(b));
}

function subtract(a, b) {
  return toDecimal(a).minus(toDecimal(b));
}

function compare(a, b) {
  return toDecimal(a).cmp(toDecimal(b));
}

function eq(a, b) {
  return toDecimal(a).eq(toDecimal(b));
}

function gt(a, b) {
  return toDecimal(a).gt(toDecimal(b));
}

function gte(a, b) {
  return toDecimal(a).gte(toDecimal(b));
}

function lt(a, b) {
  return toDecimal(a).lt(toDecimal(b));
}

function lte(a, b) {
  return toDecimal(a).lte(toDecimal(b));
}

function isZero(value) {
  return toDecimal(value).isZero();
}

function toNumber(value) {
  return toDecimal(value).toNumber();
}

module.exports = {
  toDecimal,
  fromDecimal,
  fromString,
  add,
  subtract,
  compare,
  eq,
  gt,
  gte,
  lt,
  lte,
  isZero,
  toNumber,
};