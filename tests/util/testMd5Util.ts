import Md5Util from '../../src/util/Md5Util';

describe('Md5Util', () => {
  describe('md5', () => {
    it('对固定字符串输出已知 md5', () => {
      expect(Md5Util.md5('')).toEqual('d41d8cd98f00b204e9800998ecf8427e');
      expect(Md5Util.md5('hello')).toEqual('5d41402abc4b2a76b9719d911017c592');
      expect(Md5Util.md5('supply')).toEqual('aaf9a7ade8ad853549f9ce5d53e8d645');
    });

    it('相同输入相同输出，不同输入不同输出', () => {
      expect(Md5Util.md5('a')).toEqual(Md5Util.md5('a'));
      expect(Md5Util.md5('a')).not.toEqual(Md5Util.md5('b'));
    });
  });

  describe('buildPswd', () => {
    it('格式为 md5(userName|pswd|supply)', () => {
      const expected = Md5Util.md5('admin|123456|supply');
      expect(Md5Util.buildPswd('123456', 'admin')).toEqual(expected);
    });

    it('无 userName 时仍按模板拼接', () => {
      expect(Md5Util.buildPswd('pwd')).toEqual(Md5Util.md5('undefined|pwd|supply'));
    });
  });
});
