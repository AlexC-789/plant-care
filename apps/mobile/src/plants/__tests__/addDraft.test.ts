import { plantName, typeName, type Draft } from '../addDraft';

const d = (patch: Partial<Draft>): Draft => ({ room: '', light: 'medium', ...patch });

test('typeName: common name, else scientific, else custom, else undefined', () => {
  expect(typeName(d({ species: { id: '1', name: 'Moth orchid', scientific: 'Phalaenopsis' } }))).toBe('Moth orchid');
  expect(typeName(d({ species: { id: '1', name: '', scientific: 'Phalaenopsis' } }))).toBe('Phalaenopsis');
  expect(typeName(d({ species: { custom: 'Zorb' } }))).toBe('Zorb');
  expect(typeName(d({ species: { id: '1', name: '' } }))).toBeUndefined();
  expect(typeName(d({}))).toBeUndefined();
});

test('plantName: the typed name (trimmed); untouched it is the type; cleared it is undefined', () => {
  expect(plantName(d({ nickname: ' Orla ', species: { custom: 'Zorb' } }))).toBe('Orla');
  expect(plantName(d({ species: { custom: 'Zorb' } }))).toBe('Zorb');
  expect(plantName(d({ nickname: '  ', species: { custom: 'Zorb' } }))).toBeUndefined();
  expect(plantName(d({}))).toBeUndefined();
});
