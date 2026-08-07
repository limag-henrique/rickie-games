export function toggleOrderedCard(selected:string[],cardId:string,limit:number):string[] {
  if (selected.includes(cardId)) {
    return selected.filter(selectedId => selectedId !== cardId);
  }
  return selected.length < limit ? [...selected,cardId] : selected;
}

