export type ComponentLayer = 'layout' | 'colors' | 'fonts' | 'widgets';

export type ComponentApiRule = {
  layer: ComponentLayer;
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
    layer: 'widgets',
    owns: ['buttons', 'inputs', 'message bubbles', 'product panels'],
    mustNotOwn: ['fetch calls', 'auth storage', 'deployment URLs']
  }
] satisfies ComponentApiRule[];
