export default class {
  static buildCntAndPrice(content: any[]):ICntAndPrice {
    throw new Error("Method not implemented.");
  }
  static change(noteItems: any[]) {
    let retList: any[] = [];
    for (let item of noteItems) {

      retList.push(this.changeOne(item));
    }
    return retList;
  }

  static changeOne(item: any) {
    let ret: any = {
      noteItemId: item.noteItemId
    }
    this.doChangeNoteItem(item, ret, 'purcharse', 'cnt');
    this.doChangeNoteItem(item, ret, 'instock', 'instockCnt');
    this.doChangeNoteItem(item, ret, 'sendCnt');
    if (item.supplierMaterial) {
      ret.price = item.supplierMaterial.price;
      ret.stockBuyUnitFee = item.supplierMaterial.buyUnitFee

    }
    ret.materialId = item.materialId;
    return ret;
  }

  protected static doChangeNoteItem(item: any, ret: any, srcCol: string, targetCol?: string) {
    let src = item[srcCol];
    if (src != null) {


      if (targetCol == null) {
        targetCol = srcCol;
      }
      ret[targetCol] = src.cnt;
    }
  }
}