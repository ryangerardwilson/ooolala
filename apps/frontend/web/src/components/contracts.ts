export type ComponentLayer = 'layout' | 'colors' | 'fonts' | 'l1' | 'l2' | 'l3';

export type ComponentApiRule = {
  layer: ComponentLayer;
  namespace?: 'primitives' | 'patterns' | 'product';
  directory?: string;
  owns: string[];
  mustNotOwn: string[];
};

export const componentApiRules = [
  {
    layer: 'layout',
    owns: ['spatial composition', 'screen shells', 'scroll regions', 'modal placement'],
    mustNotOwn: ['color decisions', 'font stacks', 'backend behavior']
  },
  {
    layer: 'colors',
    owns: ['semantic color roles', 'named schemes', 'CSS variable values'],
    mustNotOwn: ['component structure', 'text content', 'API state']
  },
  {
    layer: 'fonts',
    owns: ['body font stack', 'mono font stack', 'font CSS variables'],
    mustNotOwn: ['spacing', 'colors', 'network behavior']
  },
  {
    layer: 'l1',
    namespace: 'primitives',
    directory: 'components/l1',
    owns: ['L1 basic UI atoms', 'buttons', 'inputs', 'textareas', 'icons', 'status text'],
    mustNotOwn: ['fetch calls', 'auth storage', 'deployment URLs']
  },
  {
    layer: 'l2',
    namespace: 'patterns',
    directory: 'components/l2',
    owns: ['L2 reusable UX patterns', 'form fields', 'command rows', 'empty states', 'dialog forms', 'message bubbles'],
    mustNotOwn: ['fetch calls', 'auth storage', 'deployment URLs', 'page-level product flows']
  },
  {
    layer: 'l3',
    namespace: 'product',
    directory: 'components/l3',
    owns: ['L3 Ooolala product surfaces', 'landing', 'docs', 'auth panels', 'chat panels'],
    mustNotOwn: ['fetch calls', 'auth storage', 'deployment URLs', 'raw repeated control styling']
  }
] satisfies ComponentApiRule[];
