import { Rule, SchematicContext, Tree, chain, mergeWith, move, apply, url, SchematicsException, applyTemplates, MergeStrategy } from '@angular-devkit/schematics';
import { join, Path, experimental, normalize, strings } from "@angular-devkit/core";
import { Schema as ProjectTemplateOptions } from "./utils/schema";

function createFiles(name: String, path: Path) {
  return (host: Tree) => {
    host.create(join(path,"index.html" ), `<h1>Hello ${name}</h1>`);
    host.create("style.css", ``);
    host.create("script.js", ``);
    
    return host;
  };
}

function deleteFile(host: Tree, path: string) {
  if (host.exists(path)) {
    host.delete(path);
  }
}

function deleteExistingFiles(path: Path) {
  return (host: Tree) => {
    ["app.component.html",'style.css','script.ts'].forEach(filename => {
      deleteFile(host, join(path, filename));
    });
    return host;
  };
}

function updateAngularFile (_projectName: string, options: ProjectTemplateOptions){
  return (host: Tree) => {
    const workspaceConfig = host.read('/angular.json');
    if (!workspaceConfig) {
      throw new SchematicsException('Could not find Angular workspace configuration');
    }

    const workspaceContent = workspaceConfig.toString();

    const workspace: experimental.workspace.WorkspaceSchema = JSON.parse(workspaceContent);
    
    if (!options.project) {
      options.project = workspace.defaultProject;
    }
    const projectName = options.project as string;
    const project = workspace.projects[projectName] as any;
    
    project.architect.build.options.styles.push(options.path +'/style.css');
    project.architect.build.options.scripts.push(options.path +'/script.ts');

    host.overwrite('angular.json', JSON.stringify(workspace, null, 2));
  
    return host;
  };
}

export function projectTemplate(options: ProjectTemplateOptions): Rule {
  return (host: Tree, context: SchematicContext) => {
    const workspaceConfig = host.read('/angular.json');
    if (!workspaceConfig) {
      throw new SchematicsException('Could not find Angular workspace configuration');
    }

    const workspaceContent = workspaceConfig.toString();

    const workspace: experimental.workspace.WorkspaceSchema = JSON.parse(workspaceContent);
    if (!options.project) {
      options.project = workspace.defaultProject;
    }

    const projectName = options.project as string;
    const project = workspace.projects[projectName];
    const projectType = project.projectType === 'application' ? 'app' : 'lib';

    if(project.projectType !== 'application'){return host;}

    if (options.path === undefined) {
      options.path = `${project.sourceRoot}/${projectType}`;
    }

    const appPath = options.path as Path;
    const templateSource = apply(url('./files'), [
      applyTemplates({
        classify: strings.classify,
        dasherize: strings.dasherize,
        name: options.name
      }),
      move(normalize(options.path as string)),
    ])

    const rule = chain([
      deleteExistingFiles(appPath),
      mergeWith(templateSource, MergeStrategy.Overwrite),

      updateAngularFile(projectName,options),
    ]);
    return rule(host, context);
  };
}