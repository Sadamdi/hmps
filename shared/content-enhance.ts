export type ContentEnhanceEntityType =
	| 'berita'
	| 'event'
	| 'library'
	| 'store_product'
	| 'profil'
	| 'kelembagaan'
	| 'prodi'
	| 'feedback'
	| 'community'
	| 'bug_report';

export type EnhanceFieldDef = {
	key: string;
	label: string;
};

export type EnhanceFieldChange = {
	field: string;
	label: string;
	before: string;
	after: string;
	reason: string;
};

export type EnhanceContentResponse = {
	success: boolean;
	message?: string;
	data?: {
		changes: EnhanceFieldChange[];
		model: string;
		provider: string;
	};
};
