import type { Screen } from '../../state/preferences';

export type TourPanel = 'settings' | 'explorer' | null;

export interface TourStep {
  readonly title: string;
  readonly body: string;
  /** Elements to highlight: the box around every match. None for a centred card. */
  readonly target: string | null;
  readonly screen: Screen;
  /** A panel opened for the step; any other closes. */
  readonly panel?: TourPanel;
  /** Select the demo's second box, opening its sidebar. */
  readonly selectBox?: boolean;
  /** Set that box's fill to show a scale and its ranking. */
  readonly fillScale?: boolean;
}

/** The guided tour, in order. The first step is the welcome card and loads nothing until the tour starts. */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    title: 'Welcome to Fretboard Workbench',
    body: 'This tour opens a short demo progression and walks through each feature. Your own work is put back exactly as it was when the tour ends.',
    target: null,
    screen: 'workbench',
  },
  {
    title: 'Two tools',
    body: 'The workbench builds chord progressions on the fretboard. The scale wizard explores one scale: its notes, degrees and chords.',
    target: '[data-tour="app-switch"]',
    screen: 'workbench',
  },
  {
    title: 'Chord boxes',
    body: 'Click notes on a fretboard to build a chord: one note per string, six at most. Click a note again to remove it.',
    target: '.canvas > .box-group:first-child .box',
    screen: 'workbench',
  },
  {
    title: 'Names, numerals and functions',
    body:
      'Each box names its chord and gives its roman numeral in the key. With harmonic analysis on, the chord’s function sits by the neck — beside it on a horizontal board, under it on a vertical one; tap it for an explanation.',
    // The whole card, because the function tag left the header when it moved next to the board.
    target: '.canvas > .box-group:first-child .box',
    screen: 'workbench',
  },
  {
    title: 'Key bar and scale bar',
    body: 'The top bar shows the key in effect at each box, which changes when the progression tonicizes or modulates. Under it is each box’s reference scale.',
    target: '.canvas > .box-group:nth-child(-n+2) .key-band, .canvas > .box-group:nth-child(-n+2) .scale-band',
    screen: 'workbench',
  },
  {
    title: 'Between the boxes',
    body: 'Strips show the tones two chords share and how each voice moves to the next chord. The analysis lane names the relation, such as V–I or ii–V.',
    target: '.canvas > .box-group:nth-child(2) .strip',
    screen: 'workbench',
  },
  {
    title: 'Box settings',
    body: 'Selecting a box opens its settings. The root box moves the whole box, notes and scale together, a semitone at a time.',
    target: '[data-tour="root-box"]',
    screen: 'workbench',
    selectBox: true,
  },
  {
    title: 'Reference scale',
    body: 'Every box has a reference scale, which spells its notes and counts its degrees. The mode slider keeps the notes and changes which one is the root.',
    target: '[data-tour="scale-picker"]',
    screen: 'workbench',
    selectBox: true,
  },
  {
    title: 'Chord names and harmony',
    body: 'When the notes make more than one chord, choose the name here. Harmony lists every reading of the chord with an explanation; pick one to pin it, or fix the key at this box.',
    target: '[data-tour="chord-name"], [data-tour="harmony"]',
    screen: 'workbench',
    selectBox: true,
  },
  {
    title: 'Fill',
    body: 'Fill inversion maps the chord’s notes across the neck; fill scale adds the rest of its scale. Space turns the fill on or off.',
    target: '.sidebar-footer',
    screen: 'workbench',
    selectBox: true,
    fillScale: true,
  },
  {
    title: 'Scales for the chord',
    body: 'With fill scale on, every scale is ranked by how well it holds the chord. “Suggested” marks the scale the chord’s function points to. Click one to use it.',
    target: '[data-tour="ranking"]',
    screen: 'workbench',
    selectBox: true,
    fillScale: true,
  },
  {
    title: 'Key and Find key',
    body: 'Set the key yourself, or fill in the chords and press Find key to read it from the progression and give each box a fitting scale. Shift moves everything a semitone.',
    target: '[data-tour="key"]',
    screen: 'workbench',
  },
  {
    title: 'What the canvas shows',
    body: 'Draw the necks vertically like chord charts or horizontally like tab, show each chord in a window around its shape or on the whole neck, and switch common tones, voice leading and harmonic analysis on or off.',
    target: '[data-tour="neck"], [data-tour="board"], [data-tour="strips"], [data-tour="analysis"]',
    screen: 'workbench',
  },
  {
    title: 'Add a box',
    body: 'Add the next chord here. Remove a box with its × or the Delete key.',
    target: '.add-slot',
    screen: 'workbench',
  },
  {
    title: 'View mode',
    body: 'View fits the whole progression on the screen for playing or presenting, with the editing controls put away.',
    target: '[data-tour="view-mode"]',
    screen: 'workbench',
  },
  {
    title: 'Presets and examples',
    body: 'Save progressions into folders, export and import them, and start from any of the built-in pop, rock and jazz examples.',
    target: '.explorer-panel',
    screen: 'workbench',
    panel: 'explorer',
  },
  {
    title: 'Settings',
    body: 'Tuning, strings, capo, frets and fret markers are saved with each preset. Show delete warnings is a setting for this device.',
    target: '.settings-panel',
    screen: 'workbench',
    panel: 'settings',
  },
  {
    title: 'Export',
    body: 'Save the progression as a PDF or an image, choosing which chords and which parts to include and how it fits the page. The scale wizard exports the same way.',
    target: '[data-tour="export"]',
    screen: 'workbench',
  },
  {
    title: 'Scale wizard',
    body: 'Choose a tonic and a scale: any mode of the major, melodic minor, harmonic minor and other families.',
    target: '[data-tour="wizard-scale"]',
    screen: 'scales',
  },
  {
    title: 'Notes and degrees',
    body: 'The scale is lit against the chromatic octave from its tonic, with each note’s degree counted from the major scale.',
    target: '[data-tour="wizard-notes"]',
    screen: 'scales',
  },
  {
    title: 'The scale on the neck',
    body: 'Show scale draws it on the fretboard in your tuning, labelled with notes or degrees, horizontally or vertically.',
    target: '[data-tour="wizard-board"] .wizard-section-head',
    screen: 'scales',
  },
  {
    title: 'Chords in the scale',
    body: 'The chord built on each degree: its numeral in jazz or classical notation, its name, its notes and the degrees it uses. Top voice stacks triads up to 13th chords.',
    target: '[data-tour="wizard-chords"]',
    screen: 'scales',
  },
  {
    title: 'That’s the tour',
    body: 'Your work is back as you left it. Start the tour again any time from Guide in the top bar.',
    target: '[data-tour="guide"]',
    screen: 'workbench',
  },
];
