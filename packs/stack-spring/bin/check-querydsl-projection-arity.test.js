#!/usr/bin/env node
/**
 * check-querydsl-projection-arity.js 회귀 테스트 — 일부러 어긋난 픽스처로 탐지까지 확인한다 ("불일치 0" 은 검사기가 도는 증거가 아니다).
 * 같은 이름의 중첩 record 가 두 파일에 있는 경우 · record 축약 생성자 · 문자열 안의 호출 · 별칭(.as / ExpressionUtils.as) 을 함께 본다.
 *   node packs/stack-spring/bin/check-querydsl-projection-arity.test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const CHECKER = path.join(__dirname, 'check-querydsl-projection-arity.js');

const FILES = {
  'dto/SampleDto.java': `package fixture.dto;
import lombok.*;
@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class SampleDto {
  private Integer orderNumber;
  private String orderTitle;
  private String orderType;
  private java.math.BigDecimal pageNumber;
  private static final String IGNORED = "static field must not be counted";
}
`,
  'dto/RecordDto.java': `package fixture.dto;
public record RecordDto(java.util.UUID id, String a, String b, Boolean editable) {
  public RecordDto(java.util.UUID id, String a, String b) { this(id, a, b, true); }
}
`,
  'query/BadQuery.java': `package fixture.query;
import com.querydsl.core.types.Projections;
import fixture.dto.*;
public class BadQuery {
  void bad() { Projections.constructor(SampleDto.class, a, b, c, d, e); }
  void ok() { Projections.constructor(SampleDto.class, a, b, c, d); }
  void okShort() { Projections.constructor(RecordDto.class, a, b, c); }
  void okFull() { Projections.constructor(RecordDto.class, a, b, c, d); }
  void badRecord() { Projections.constructor(RecordDto.class, a, b, c, d, e); }
  void trap() { String s = "Projections.constructor(SampleDto.class, a)"; }
  void nested() { Projections.constructor(Dup.class, a, b); }
  void fieldsOk() { Projections.fields(SampleDto.class, q.orderNumber, q.orderTitle.as("orderType")); }
  void fieldsBad() { Projections.fields(SampleDto.class, q.orderNumber, q.nope, x.y.as("alsoNope")); }
  void beanAlias() { Projections.bean(SampleDto.class, ExpressionUtils.as(sub, "pageNumber")); }
  public record Dup(String x, String y) {}
}
`,
  'query/OtherQuery.java': `package fixture.query;
public class OtherQuery {
  public record Dup(String x, String y, String z) {}
}
`,
};

function run(root) {
  try {
    return { code: 0, out: execFileSync('node', [CHECKER, '--root', root], { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, out: e.stdout || '' };
  }
}

function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arity-'));
  for (const [rel, body] of Object.entries(FILES)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }

  const fail = [];
  const r = run(root);
  fs.rmSync(root, { recursive: true, force: true });

  if (r.code !== 1) fail.push(`어긋난 픽스처인데 exit ${r.code} (1이어야 한다)`);
  if (!/어긋난 곳 3건/.test(r.out)) fail.push('탐지 건수가 3건이 아니다 (constructor 2 + fields 1)');
  if (!/SampleDto : 넘긴 인자 5 → 생성자 0 또는 4/.test(r.out)) fail.push('Lombok 전필드 생성자 케이스 미탐지');
  if (!/RecordDto : 넘긴 인자 5 → 생성자 0 또는 3 또는 4/.test(r.out)) fail.push('record 축약 생성자 케이스 미탐지');
  if (/검사한 Projections.constructor 6곳/.test(r.out) === false) fail.push('문자열 리터럴 안의 호출을 세고 있다');
  if (/Dup/.test(r.out)) fail.push('같은 이름 중첩 record 를 다른 파일 것으로 잡았다(오탐)');
  if (!/fields\/bean 3곳/.test(r.out)) fail.push('fields/bean 계수가 3곳이 아니다');
  if (!/SampleDto : nope, alsoNope/.test(r.out)) fail.push('fields 의 없는 필드명 2건을 못 잡았다');
  if (/판단 불가/.test(r.out)) fail.push('별칭(.as / ExpressionUtils.as)을 못 읽어 판단 불가로 빠졌다');

  if (fail.length) {
    console.log('✗ 실패 ' + fail.length + '건');
    for (const f of fail) console.log('  - ' + f);
    process.exit(1);
  }
  console.log(
    '✓ 검사기 회귀 테스트 통과 (constructor 탐지 2 · fields 탐지 1 · 정상 무시 · 별칭 해석 · 문자열/동명 중첩 오탐 없음)',
  );
}

main();
