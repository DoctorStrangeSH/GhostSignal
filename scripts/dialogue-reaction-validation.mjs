// Special interrogation responses are presented as temporary dialogue nodes.
// Their answer targets are just as important as ordinary tree transitions.
export function validateDialogueReactionTargets(dialogue) {
    const errors = [];
    const nodes = dialogue?.tree?.nodes || {};
    for (const collection of ['evidenceReactions', 'contradictionReactions']) {
        for (const [reactionId, reaction] of Object.entries(dialogue?.[collection] || {})) {
            const label = `Dialogue ${dialogue.id} ${collection}/${reactionId}`;
            if (!reaction || typeof reaction.text !== 'string' || !reaction.text.trim()) {
                errors.push(`${label} has missing reaction text.`);
            }
            if (reaction?.answers !== undefined && !Array.isArray(reaction.answers)) {
                errors.push(`${label} has invalid answers.`);
                continue;
            }
            for (const answer of reaction?.answers || []) {
                if (!answer?.nextNode || !nodes[answer.nextNode]) {
                    errors.push(`${label} points to missing node: ${answer?.nextNode || '(empty)'}`);
                }
            }
        }
    }
    return errors;
}
