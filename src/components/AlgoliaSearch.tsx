import algoliasearch from 'algoliasearch/lite';
import React, { useState } from 'react';

// Utilise ta Search-Only API Key (Celle-ci est publique et sécurisée)
const searchClient = algoliasearch('ZYRHOXK3WR', '0f30737976e1074092f6c039327891be');
const index = searchClient.initIndex('products');

const AlgoliaSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.length > 2) {
      const { hits } = await index.search(text, {
        hitsPerPage: 10,
      });
      setResults(hits);
    } else {
      setResults([]);
    }
  };

  return (
    // Ici ton UI avec un TextInput qui appelle handleSearch
    // Et une FlatList pour afficher les 'results'
  );
};