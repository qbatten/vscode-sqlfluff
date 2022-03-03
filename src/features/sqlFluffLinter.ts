"use strict";
import * as vscode from "vscode";
import { Diagnostic, DiagnosticSeverity, Disposable, Range } from "vscode";

import { DocumentFormattingEditProvider } from "./formatter/formattingProvider";
import { Configuration } from "./Helpers/configuration";
import { Linter, LinterConfiguration, LintingProvider } from "./utils/lintingProvider";

export class SQLFluffLinterProvider implements Linter {
	public languageId = ["sql", "jinja-sql", "sql-bigquery"];

	public activate(subscriptions: Disposable[]) {
		const provider = new LintingProvider(this);
		provider.activate(subscriptions);
	}

	public loadConfiguration(): LinterConfiguration {
		const linterConfiguration = {
			executable: Configuration.executablePath(),
			fileArgs: ["lint", "--format", "json"],
			bufferArgs: ["lint", "--format", "json", "-"],
			extraArgs: Configuration.extraArguments(),
			runTrigger: Configuration.runTrigger(),
			formatterEnabled: Configuration.formattingEnabled(),
		};

		return linterConfiguration;
	}

	public process(lines: string[]): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		lines.forEach((line) => {
			const filePaths: Array<FilePath> = JSON.parse(line);

			filePaths.forEach((filePath: FilePath) => {
				filePath.violations.forEach((violation: Violation) => {
					const diagnostic = new Diagnostic(
						new Range(
							violation.line_no - 1,
							violation.line_pos,
							violation.line_no - 1,
							violation.line_pos
						),
						violation.description,
						DiagnosticSeverity.Error,
					);
					diagnostic.code = violation.code;
					diagnostic.source = "sqlfluff";
					diagnostics.push(diagnostic);
				});
			});

		});

		return diagnostics;
	}
}

interface FilePath {
	violations: Array<Violation>;
}

export class SQLFLuffDocumentFormattingEditProvider {
	activate(): vscode.DocumentFormattingEditProvider {
		const configuration = new SQLFluffLinterProvider().loadConfiguration;
		return new DocumentFormattingEditProvider(configuration);
	}
}

interface Violation {
	line_no: number,
	line_pos: number,
	description: string,
	code: string,
}

export class SQLFluffQuickFix implements vscode.CodeActionProvider {
	public static readonly providedCodeActionKind = [
		vscode.CodeActionKind.QuickFix,
	];

	provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range | vscode.Selection,
		context: vscode.CodeActionContext,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		token: vscode.CancellationToken
	): vscode.CodeAction[] {
		// for each diagnostic entry that has the matching `code`, create a code action command
		return context.diagnostics.map((diagnostic) =>
			this.createCodeAction(diagnostic)
		);
	}

	private createCodeAction(
		diagnostic: vscode.Diagnostic
	): vscode.CodeAction {
		const action = new vscode.CodeAction(
			`Exclude Rule ${diagnostic.code}`,
			vscode.CodeActionKind.QuickFix
		);
		action.command = {
			command: EXCLUDE_RULE,
			title: `Exclude Rule ${diagnostic.code}`,
			tooltip: `This will exclude the rule ${diagnostic.code} in settings.json`,
			arguments: [diagnostic.code]
		};
		action.diagnostics = [diagnostic];
		action.isPreferred = true;

		return action;
	}
}

export const EXCLUDE_RULE = "sqlfluff.quickfix.command";
