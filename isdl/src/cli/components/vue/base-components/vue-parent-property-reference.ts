import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';
import { Entry } from '../../../../language/generated/ast.js';

export default function generateParentPropertyReferenceComponent(destination: string, entry?: Entry) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, "parent-property-reference.vue");

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
<template>
  <div class="isdl-parent-property-reference single-wide">
    <div class="field-label" v-if="props.label">
      <span v-html="getLabel(props.label, props.icon)" />
    </div>
    <v-select
      :name="props.systemPath"
      v-model="props.context[props.systemPath]"
      :items="refChoices"
      item-title="label"
      item-value="value"
      :disabled="isDisabled"
      v-if="!isHidden"
      :color="color"
      variant="outlined"
      density="compact">
      <template #label>
        <span v-html="getLabel(props.label, props.icon)" />
      </template>
    </v-select>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  context: {
    type: Object,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: false
  },
  systemPath: {
    type: String,
    required: true
  },
  refChoices: {
    type: Array,
    required: true,
    default: () => []
  },
  disabled: {
    type: Boolean,
    default: false
  },
  hidden: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: 'primary'
  }
});

const isDisabled = computed(() => {
  return props.disabled;
});

const isHidden = computed(() => {
  return props.hidden;
});

// Expose helper function
const getLabel = (label, icon) => {
  if (icon) {
    return \`<i class="\${icon}"></i> \${label}\`;
  }
  return label;
};
</script>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}