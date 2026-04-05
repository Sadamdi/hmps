import RichHtmlWithEmbeds from './rich-html-with-embeds';

export default function LibraryFullDescription({ content }: { content: string }) {
	return <RichHtmlWithEmbeds content={content} />;
}
