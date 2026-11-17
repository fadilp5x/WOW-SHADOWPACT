import test from 'node:test';
import assert from 'node:assert/strict';
import { getRemedy } from '../src/remedies.js';

const record = {
  appName: 'Example',
  privacyUrl: 'https://example.com/privacy',
  sorted: { yourRights: [
    { title: 'Opt out of targeted advertising', description: 'Use advertising controls.', source: { url: 'https://example.com/privacy#ads' } },
    { title: 'Request deletion of your data', description: 'Request eligible data deletion.', source: { url: 'https://example.com/privacy#deletion' } },
    { title: 'Manage location permissions', description: 'Review location access.', source: { url: 'https://example.com/privacy#location' } },
  ] },
};

test('all eight body targets have practical lessons with separate past-data actions', () => {
  const titles = new Set();
  for (const target of ['EYES','EARS','MOUTH','HEAD','HEART','HANDS','FEET','VAULT']) {
    const lesson = getRemedy({bodyTarget:target}, record);
    assert.equal(lesson.bodyTarget,target);
    assert.ok(lesson.steps.length >= 4);
    assert.match(lesson.steps.map(x=>x.body).join(' '), /delet|erase|remove existing|recall/i);
    assert.doesNotMatch(JSON.stringify({title:lesson.title,intro:lesson.intro,steps:lesson.steps}), /\u2014/);
    titles.add(lesson.title);
  }
  assert.equal(titles.size,8);
});

test('briefcase and hands share one lesson and the input remains unchanged', () => {
  const before=JSON.stringify(record);
  const lesson=getRemedy({bodyTarget:'HANDS and the BRIEFCASE'},record);
  assert.equal(lesson.bodyTarget,'HANDS');
  assert.match(lesson.steps.map(x=>x.body).join(' '), /delete uploaded contacts/);
  lesson.steps[0].body='changed';
  lesson.rights[0].title='changed';
  assert.equal(JSON.stringify(record),before);
  assert.notEqual(getRemedy({bodyTarget:'HANDS'},record).steps[0].body,'changed');
});

test('only relevant real rights are included, with general deletion rights retained', () => {
  assert.deepEqual(getRemedy({bodyTarget:'EYES'},record).rights.map(x=>x.title),['Request deletion of your data']);
  assert.deepEqual(getRemedy({bodyTarget:'HEAD'},record).rights.map(x=>x.title),['Opt out of targeted advertising','Request deletion of your data']);
  assert.deepEqual(getRemedy({bodyTarget:'FEET'},record).rights.map(x=>x.title),['Request deletion of your data','Manage location permissions']);
  assert.deepEqual(getRemedy({bodyTarget:'EARS'},{}).rights,[]);
});

test('source links are taken only from supplied real rights or official privacy URL', () => {
  assert.equal(getRemedy({bodyTarget:'HEAD',source:{url:'https://invented.test'}},record).sourceUrl,'https://example.com/privacy#ads');
  assert.equal(getRemedy({bodyTarget:'EYES'}, {privacyUrl:'https://example.com/privacy'}).sourceUrl,'https://example.com/privacy');
  const hostile={privacyUrl:'javascript:alert(1)',sorted:{yourRights:[{title:'Delete data',source:{url:'https://user:pass@example.com'}}]}};
  assert.equal(getRemedy({bodyTarget:'EYES'},hostile).sourceUrl,null);
  assert.equal(getRemedy({},{}).sourceUrl,null);
});

test('location and payments retain material limitations', () => {
  const location=getRemedy({bodyTarget:'FEET'},record).steps.map(x=>x.body).join(' ');
  assert.match(location,/IP address/);
  assert.match(location,/does not remove past location data/);
  const payment=getRemedy({bodyTarget:'VAULT'},record).steps.map(x=>x.body).join(' ');
  assert.match(payment,/deleting the app does not cancel billing/);
  assert.match(payment,/does not cancel a subscription/);
  assert.match(payment,/records may have to be retained/);
});

test('unknown categories use a general safe lesson', () => {
  const lesson=getRemedy({bodyTarget:'OTHER'},record);
  assert.equal(lesson.bodyTarget,'UNKNOWN');
  assert.match(lesson.intro,/official privacy instructions/);
  assert.ok(lesson.steps.length);
});
