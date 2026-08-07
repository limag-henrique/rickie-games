export function shuffled<T>(values:T[],random:()=>number):T[] {
  const result=structuredClone(values);
  for (let index=result.length-1;index>0;index--) {
    const target=Math.floor(random()*(index+1));
    [result[index],result[target]]=[result[target]!,result[index]!];
  }
  return result;
}
