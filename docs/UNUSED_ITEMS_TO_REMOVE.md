# Unused Items Safe to Remove

## High Confidence - Safe to Remove

### 1. Unused Utility Classes (Margin/Padding)
These utility classes are not found in HTML:
- `.mb0`, `.mb5`, `.mb10`, `.mb15`, `.mb20`, `.mb25`, `.mb30`
- `.mt0`, `.mt5`, `.mt10`, `.mt15`, `.mt20`, `.mt25`, `.mt30`, `.mt35`, `.mt40`, `.mt45`, `.mt50`, `.mt55`, `.mt60`
- `.ml0`, `.ml5`, `.ml10`, `.ml15`, `.ml20`
- `.mr0`, `.mr5`, `.mr10`, `.mr15`, `.mr20`

### 2. Unused Component Classes
- `.approachSection` and all `.approachSection__*` classes
- `.collaborationBlock` and all `.collaboration__*` classes
- `.campusBlock` and all `.campusBlock__*` classes
- `.searchCampus` and all `.searchCampus*` classes
- `.ctaButton` and all `.ctaButton__*` classes
- `.ctaBanner__title`, `.ctaBanner__label`, `.ctaBanner__list`, `.ctaBanner__listInner`, `.ctaBanner__item`

### 3. Unused Hero Section Classes
- `.heroSection__badge`
- `.heroSection__frame`
- `.heroSection__inner`
- `.heroSection__visual`

### 4. Unused Point Item Classes
- `.pointItem__exhibition`
- `.pointItem__exhibitionLink`
- `.pointItem__exhibitionName`
- `.pointItem__leadImg`
- `.pointItem__leadMedia` (Note: `.pointItem__leadMedia` might be used, check carefully)
- `.pointItem__ribbon`

### 5. Unused Modifier Classes
- `.-animImg`, `.-noAnimImg`
- `.-block`
- `.-blue`, `.-red`, `.-navy`
- `.-center`, `.-left`, `.-right`
- `.-checkbox`, `.-radio`
- `.-clark`, `.-gakken`
- `.-conma`, `.-date`, `.-period`
- `.-dialogNoSupport`
- `.-doc`, `.-icon`, `.-img`
- `.-empty` (check if used in JS)
- `.-flexText`
- `.-fontL`
- `.-grid01` through `.-grid09`
- `.-introEnd`
- `.-lead`
- `.-main`
- `.-marginSmall`
- `.-menuOpen`
- `.-note`
- `.-open`, `.-openCampus`
- `.-pcCol02`, `.-pcMenu`, `.-pcPadding`
- `.-penType`, `.-plusType`, `.-simpleType`
- `.-required`
- `.-sp2Line`, `.-spBlock`, `.-spCol02`, `.-spItem`, `.-spPadding`
- `.-sub`
- `.-support`, `.-teaching`
- `.-textCenter`, `.-textLeft`, `.-textRight`
- `.-tight`
- `.-toDown`, `.-toLeft`, `.-toRight`, `.-toUp`
- `.-verTop`
- `.-visited`

### 6. Unused Form Classes
- `.formButton`
- `.formLabel`, `.formLabelParent`
- `.formPrivacy`, `.formPrivacy__contents`, `.formPrivacy__title`
- `.formTable`
- `.input`, `.inputWrap`
- `.select`, `.selectWrap`
- `.textarea`
- `.postalButton`

### 7. Unused Footer Classes
- `.footer__bottom` and all `.footer__bottom*` classes
- `.footer__top` and all `.footer__top*` classes

### 8. Unused List/Table Classes
- `.listDisc`
- `.note`, `.noteList`
- `.reasonItem` and all `.reasonItem__*` classes
- `.reasonList`
- `.spTableScroll` and all `.spTableScroll__*` classes
- `.timeTable`, `.timeTableCaption`, `.timeTable__img`, `.timeTable__note`
- `.titleQA`

### 9. Unused Slider Classes (Splide)
- `.splide` and all `.splide__*` classes
- `.splide--rtl`

### 10. Unused Other Classes
- `.backdrop`
- `.bgBoxBlock`, `.bgBoxItem`, `.bgBoxItem__img`, `.bgBoxItem__title`
- `.button`, `.buttonNote`
- `.error`, `.errorBlock`, `.errorBlockTitle`
- `.fixed`
- `.iframeParent`
- `.is-active`, `.is-focus-in`, `.is-initialized`, `.is-load`, `.is-rendered`
- `.mainVisual` and all `.mainVisual__*` classes
- `.org`
- `.png`, `.webp`
- `.screenReaderText`
- `.sectionTitle__pointLead`, `.sectionTitle__pointText`
- `.telLink`
- `.theme-switcher`, `.theme-palette-1`, `.theme-palette-2`, `.theme-palette-3`
- `.w3`

### 11. Unused CSS IDs (Color Hex Codes - False Positives)
Many of these are color values, not actual selectors. However, some might be:
- `#svg-animation`
- Various color hex codes that might be used in CSS but not as selectors

## Medium Confidence - Review Before Removing

### Classes that might be used dynamically:
- `.accordion__placeholder` - Check if added by JavaScript
- `.is-header-hero`, `.is-header-solid` - Check if added by JavaScript
- `.is-open` - Check if added by JavaScript
- `.is-selected` - Check if added by JavaScript
- `.is-visible` - Check if added by JavaScript
- `.slotDay`, `.slotDay--empty`, `.slotDay--selected` and all `.slotDay__*` classes - These are created dynamically by JavaScript

## Low Confidence - Keep for Now

These might be used in ways not detected:
- Classes with `-` prefix that might be used conditionally
- Classes that might be added by third-party libraries
- Classes used in media queries or pseudo-selectors

## Commented Out HTML to Review

Found in `index.html`:
1. Navigation item for FAQ (line ~267-269)
2. Hero words image (line ~299-304)
3. AccessDove widget script (line ~1887-1893)

## Action Items

1. **Backup first**: Create a backup before removing anything
2. **Test thoroughly**: After removing CSS, test all pages and interactions
3. **Remove in batches**: Remove one category at a time and test
4. **Use version control**: Commit before and after each batch removal
5. **Consider CSS purging**: Use PurgeCSS or similar tool for automated removal

## Estimated Savings

- **Current CSS**: ~9,899 lines
- **Potentially unused**: ~60% = ~5,939 lines
- **Safe to remove (high confidence)**: ~40-50% = ~4,000-5,000 lines

Removing unused CSS could reduce file size significantly and improve page load times.

