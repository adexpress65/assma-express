async function main() {
  const host = 'https://ZYRHOXK3WR-dsn.algolia.net';
  const headers = {
    'X-Algolia-Application-Id': 'ZYRHOXK3WR',
    'X-Algolia-API-Key': '28b16aa67095fa844e0ef397d15b7a66',
    'Content-Type': 'application/json',
  };

  async function search(label, query, filters) {
    const body = { query, hitsPerPage: 5 };
    if (filters) body.filters = filters;
    const r = await fetch(host + '/1/indexes/products/query', {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    const d = await r.json();
    console.log(`\n=== ${label} === (${d.nbHits} hits)`);
    (d.hits || []).slice(0, 5).forEach(h =>
      console.log(`  - ${h.name} | categoryName: "${h.categoryName}"`)
    );
    if (d.message) console.log('  ERROR:', d.message);
  }

  await search(
    'basket + filtre chaussures',
    'basket',
    "categoryName:'Mode & Accessoires' OR categoryName:'Chaussure homme' OR categoryName:'Chaussures femmes'"
  );

  await search(
    'robe + filtre vêtements',
    'robe',
    "categoryName:'Mode & Vêtements' OR categoryName:'Robe pour femme' OR categoryName:'Adulte et enfant' OR categoryName:'Bébé & Enfant'"
  );

  await search('basket SANS filtre', 'basket', null);
  await search('robe SANS filtre', 'robe', null);
}

main().catch(console.error);
