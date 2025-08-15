export const getPhrasesCount = async (): Promise<number> => {
  const response = await fetch('http://localhost:8000/phrases/count');
  if (!response.ok) {
    throw new Error('Failed to fetch phrases count');
  }
  const data = await response.json();
  return data.count;
};

export const getPhrase = async (index: number): Promise<string> => {
  const response = await fetch(`http://localhost:8000/phrases/${index}`);
  if (!response.ok) {
    throw new Error('Failed to fetch phrase');
  }
  const data = await response.json();
  return data.phrase;
};
