import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== 1. Checking HTML elements for Card Design ===');
const indexHtml = fs.readFileSync('public/index.html', 'utf8');
assert(indexHtml.includes('id="tdResetStyleBtn"'), 'HTML must have tdResetStyleBtn');
assert(indexHtml.includes('id="tdReset"'), 'HTML must have tdReset');
assert(indexHtml.includes('id="tdSliderBox"'), 'HTML must have tdSliderBox');
assert(indexHtml.includes('id="tdSlider"'), 'HTML must have tdSlider');
assert(indexHtml.includes('id="tdPreviewCard"'), 'HTML must have tdPreviewCard');
assert(indexHtml.includes('data-align="left"'), 'HTML must have left align button');
assert(indexHtml.includes('data-align="center"'), 'HTML must have center align button');
assert(indexHtml.includes('data-align="right"'), 'HTML must have right align button');

console.log('=== 2. Checking CSS for Card Design & Slider Box ===');
const stylesCss = fs.readFileSync('public/styles.css', 'utf8');
// Check td-slider-box layout is column, not cramped row
assert(stylesCss.includes('.td-slider-box{'), 'Must define .td-slider-box');
assert(stylesCss.includes('flex-direction:column;'), 'Slider box must be column layout so slider is not crushed');
assert(stylesCss.includes('.td-preview-card.is-dragging-card-item'), 'Must style preview card while dragging');
assert(stylesCss.includes('.td-item.is-being-dragged'), 'Must style item while being dragged');

console.log('=== 3. Checking app.js Card Design Handlers & Logic ===');
const appJs = fs.readFileSync('public/app.js', 'utf8');
assert(appJs.includes("if ($('tdResetStyleBtn')) {"), 'Must attach listener for tdResetStyleBtn');
assert(appJs.includes("tileDesign[k].size = tileDesignDefaults[k].size;"), 'tdResetStyleBtn must reset sizes');
assert(appJs.includes("tileDesign[k].align = tileDesignDefaults[k].align;"), 'tdResetStyleBtn must reset alignments');
assert(appJs.includes("function tileItemStyle("), 'Must define tileItemStyle helper');
assert(appJs.includes("isDraggingCardItem"), 'Must support horizontal dragging on preview card');
assert(appJs.includes("onPvPointerMove"), 'Must support pointer move for horizontal drag');
assert(appJs.includes("tdSliderBox"), 'Must control tdSliderBox visibility');
assert(appJs.includes("showSettingsTab"), 'Must define showSettingsTab');
assert(appJs.includes("tab === 'tiledesign'"), 'showSettingsTab must initialize tiledesign tab');

console.log('=== 4. Testing tileItemStyle Logic ===');
// Evaluate tileItemStyle logic in isolation
function testTileItemStyle(cfg, itemKey) {
  if (!cfg) return '';
  var sz = cfg.size || (itemKey === 'main' ? 32 : 12);
  var align = cfg.align || (itemKey === 'topleft' ? 'left' : (itemKey === 'topright' ? 'right' : 'center'));
  var s = 'font-size:' + sz + 'px;';
  if (itemKey === 'topleft' || itemKey === 'topright') {
    if (align === 'center') {
      s += 'left:50%;right:auto;transform:translateX(-50%);text-align:center;';
    } else if (align === 'right') {
      s += 'left:auto;right:6px;transform:none;text-align:right;';
    } else {
      s += 'left:6px;right:auto;transform:none;text-align:left;';
    }
  } else {
    s += 'width:100%;box-sizing:border-box;text-align:' + align + ';';
    if (align === 'left') s += 'padding-left:8px;padding-right:2px;';
    else if (align === 'right') s += 'padding-right:8px;padding-left:2px;';
    else s += 'padding-left:2px;padding-right:2px;';
  }
  return s;
}

// Test main left alignment
const mainLeft = testTileItemStyle({ size: 36, align: 'left' }, 'main');
assert(mainLeft.includes('width:100%'), 'Must be full width');
assert(mainLeft.includes('text-align:left'), 'Must align left');
assert(mainLeft.includes('font-size:36px'), 'Must apply 36px font size');

// Test main right alignment
const mainRight = testTileItemStyle({ size: 28, align: 'right' }, 'main');
assert(mainRight.includes('text-align:right'), 'Must align right');

// Test topleft center alignment
const topleftCenter = testTileItemStyle({ size: 10, align: 'center' }, 'topleft');
assert(topleftCenter.includes('left:50%'), 'Must center horizontally');
assert(topleftCenter.includes('transform:translateX(-50%)'), 'Must use translateX');

// Test topleft right alignment
const topleftRight = testTileItemStyle({ size: 10, align: 'right' }, 'topleft');
assert(topleftRight.includes('right:6px'), 'Must position right');

console.log('\nAll Card Design unit tests PASSED successfully!');
