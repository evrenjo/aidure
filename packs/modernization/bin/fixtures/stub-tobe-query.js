#!/usr/bin/env node
// Fixture: stand-in for a TO-BE query extractor (`<file> --json` → {results:[{method, columns, raw}]}). Test only.
'use strict'
console.log(JSON.stringify({
  results: [
    { method: 'findItems', columns: ['item_master.fsc_code', 'item_master.deleted_flag', 'item_master.country_code'], raw: { tables: [], cols: [] } },
    { method: 'nativeCount', columns: [], raw: { tables: ['detail_line'], cols: ['plan_id'] } },
  ],
}))
