# Unused Code Analysis Report

## Summary
Analysis of unused CSS classes, IDs, JavaScript, and HTML elements in the codebase.

## Key Findings

### CSS Analysis
- **Total CSS selectors found**: 491
- **Unused CSS selectors**: 298 (60.7% of all CSS)
  - Unused CSS classes: 227
  - Unused CSS IDs: 71 (Note: Many are color hex codes, not actual selectors)

### HTML Analysis
- **Total HTML classes**: 165
- **Total HTML IDs**: 30
- **HTML classes without CSS**: 10 (likely used by JavaScript)
- **HTML IDs without CSS**: 25 (likely used by JavaScript)

### JavaScript Analysis
- **Total JS identifiers**: 256
- Many classes/IDs are referenced dynamically in JavaScript

## Top Unused CSS Classes (Sample)

### Utility Classes (likely unused)
- `.mb0`, `.mb5`, `.mb10`, `.mb15`, `.mb20`, `.mb25`, `.mb30` (margin-bottom utilities)
- `.mt0`, `.mt5`, `.mt10`, `.mt15`, `.mt20`, `.mt25`, `.mt30`, `.mt35`, `.mt40`, `.mt45`, `.mt50`, `.mt55`, `.mt60` (margin-top utilities)
- `.ml0`, `.ml5`, `.ml10`, `.ml15`, `.ml20` (margin-left utilities)
- `.mr0`, `.mr5`, `.mr10`, `.mr15`, `.mr20` (margin-right utilities)
- `.-center`, `.-left`, `.-right` (alignment utilities)
- `.-textCenter`, `.-textLeft`, `.-textRight` (text alignment)

### Component Classes (likely unused)
- `.approachSection` and related classes
- `.collaborationBlock` and related classes
- `.campusBlock` and related classes
- `.ctaButton` and related classes
- `.ctaBanner__title`, `.ctaBanner__label`, `.ctaBanner__list`
- `.heroSection__badge`, `.heroSection__frame`, `.heroSection__inner`, `.heroSection__visual`
- `.pointItem__exhibition`, `.pointItem__leadImg`, `.pointItem__leadMedia`, `.pointItem__ribbon`
- `.searchCampus` and related classes
- `.splide` and related classes (slider library)
- `.theme-switcher` and theme palette classes

### Modifier Classes (likely unused)
- `.-animImg`, `.-noAnimImg`
- `.-block`, `.-grid01` through `.-grid09`
- `.-checkbox`, `.-radio`
- `.-clark`, `.-gakken`, `.-penType`, `.-plusType`, `.-simpleType`
- `.-conma`, `.-date`, `.-period`
- `.-dialogNoSupport`
- `.-doc`, `.-icon`, `.-img`
- `.-introEnd`
- `.-menuOpen`, `.-open`, `.-openCampus`
- `.-navy`, `.-red`, `.-blue`
- `.-pcCol02`, `.-pcMenu`, `.-pcPadding`
- `.-sp2Line`, `.-spBlock`, `.-spCol02`, `.-spItem`, `.-spPadding`
- `.-support`, `.-teaching`
- `.-toDown`, `.-toLeft`, `.-toRight`, `.-toUp`
- `.-verTop`, `.-visited`

## HTML Classes Used in JavaScript (Not in CSS)

These classes are referenced in JavaScript but don't have CSS definitions:
- `.anchorLink`
- `.header__logoImage`
- `.js-dialogClose`
- `.js-dialogOpen`
- `.skip-link`
- `.slotPicker__navBtn--next`
- `.slotPicker__navBtn--prev`
- `.-before`
- `.-service`
- `.ctaYokoBanner__ctaText`

## HTML IDs Used in JavaScript (Not in CSS)

These IDs are referenced in JavaScript but don't have CSS definitions:
- `#dialogCampus`
- `#trialForm`
- `#trialName`, `#trialEmail`, `#trialTel`
- `#slotPicker`, `#slotPickerBody`, `#slotWeekLabel`
- `#slotPrevWeek`, `#slotNextWeek`
- `#slotISO`, `#slotSelectionStatus`
- `#submitBtn`, `#resultMsg`
- `#trialReserveSection`
- `#accordionFaq01` through `#accordionFaq05`
- `#sectionCoaching`, `#sectionPoints`, `#sectionVoices`
- `#seqFaq`, `#seqSiteLinks`

## Commented Out HTML

Found 13 commented-out HTML blocks. These may contain:
- Old navigation items
- Disabled features
- Development notes

## Recommendations

1. **Remove unused utility classes** - Many margin/padding utility classes appear unused
2. **Remove unused component classes** - Components like `.approachSection`, `.collaborationBlock`, `.campusBlock` appear unused
3. **Remove unused modifier classes** - Many `.-` prefixed modifier classes are unused
4. **Clean up commented HTML** - Review and remove or uncomment as needed
5. **Consider CSS purging** - Use a tool like PurgeCSS to automatically remove unused CSS
6. **Keep JavaScript-referenced classes/IDs** - Even if not in CSS, keep classes/IDs that are used in JavaScript

## Files to Review

- `lp01/common/css/common.css` - Contains most unused CSS
- `lp01/common/css/override.css` - Contains some unused CSS
- `index.html` - Contains commented-out HTML blocks

## Next Steps

1. Review the unused CSS classes list and confirm they're not needed
2. Remove confirmed unused CSS to reduce file size
3. Review commented HTML and decide whether to remove or restore
4. Consider implementing CSS purging in your build process

