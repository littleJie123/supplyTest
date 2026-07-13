module.exports = {
  clearMocks: true,
  collectCoverage: false,
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // 匹配 tests/**/test*.ts 以及 *.test.ts / *.spec.ts
  testRegex: '(/tests/.*|(\\.|/)(test|spec))\\.ts?$',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  globals: {
    'ts-jest': {
      // 项目 TypeScript 5.x，ts-jest@24 不支持完整诊断，关闭以免误报
      diagnostics: false,
      tsConfig: '<rootDir>/tsconfig.jest.json',
    },
  },
  // 避免 Windows 下偶发 open handle 导致进程不退出
  forceExit: true,
};
