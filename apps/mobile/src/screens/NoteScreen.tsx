import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View, TextInput, ScrollView, Text, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMobileStore } from "../store/mobileStore";
import { parseTasks } from "@daymark/core";
import type { RootStackParams } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParams, "Note">;

export function NoteScreen({ route }: Props) {
  const { noteId } = route.params;
  const { notes, saveNote } = useMobileStore();
  const note = notes.get(noteId);

  const [content, setContent] = useState(note?.content ?? "");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save with 800ms debounce (matching desktop)
  const scheduleAutosave = useCallback((text: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveNote(noteId, text);
    }, 800);
  }, [noteId, saveNote]);

  function handleChange(text: string) {
    setContent(text);
    scheduleAutosave(text);
  }

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveNote(noteId, content);
      }
    };
  }, []);

  const openTasks = parseTasks(content, note?.date)
    .filter((t) => t.state === "open");

  function toggleTask(lineIndex: number) {
    const lines = content.split("\n");
    const line = lines[lineIndex];
    if (!line) return;
    if (line.includes("- [ ]")) {
      lines[lineIndex] = line.replace("- [ ]", "- [x]");
    } else if (line.includes("- [x]")) {
      lines[lineIndex] = line.replace("- [x]", "- [ ]");
    }
    const newContent = lines.join("\n");
    setContent(newContent);
    saveNote(noteId, newContent);
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={88}
    >
      {/* Task summary bar */}
      {openTasks.length > 0 && (
        <View style={s.taskBar}>
          <Text style={s.taskBarText}>{openTasks.length} open task{openTasks.length !== 1 ? "s" : ""}</Text>
        </View>
      )}

      {/* Inline task list overlay */}
      {openTasks.length > 0 && (
        <ScrollView style={s.tasksScroll} horizontal showsHorizontalScrollIndicator={false}>
          <View style={s.tasksRow}>
            {openTasks.slice(0, 5).map((task) => (
              <TouchableOpacity
                key={task.id}
                style={s.taskChip}
                onPress={() => toggleTask(task.lineIndex)}
              >
                <Text style={s.taskChipCheck}>○</Text>
                <Text style={s.taskChipText} numberOfLines={1}>{task.content}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Editor */}
      <ScrollView style={s.editorScroll} keyboardShouldPersistTaps="handled">
        <TextInput
          style={s.editor}
          multiline
          value={content}
          onChangeText={handleChange}
          placeholder="Start writing…"
          placeholderTextColor="#444"
          autoCapitalize="sentences"
          autoCorrect={true}
          scrollEnabled={false}
          textAlignVertical="top"
          selectionColor="#7c6fff"
        />
      </ScrollView>

      {/* Formatting toolbar */}
      <View style={s.toolbar}>
        {["**Bold**", "_Italic_", "- [ ] ", "# ", "[[", "```"].map((token) => (
          <TouchableOpacity key={token} style={s.toolbarBtn}>
            <Text style={s.toolbarBtnText}>{token.replace(/\*/g, "B").replace(/_/g, "I")}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#141414" },

  taskBar: {
    backgroundColor: "rgba(124,111,255,0.08)",
    borderBottomWidth: 1,
    borderBottomColor: "#2e2e2e",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  taskBarText: { fontSize: 11, color: "#7c6fff", fontWeight: "600" },

  tasksScroll: { maxHeight: 42, flexGrow: 0 },
  tasksRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
  },
  taskChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#2e2e2e",
    maxWidth: 200,
  },
  taskChipCheck: { fontSize: 12, color: "#7c6fff" },
  taskChipText:  { fontSize: 12, color: "#e8e8e8", flexShrink: 1 },

  editorScroll: { flex: 1 },
  editor: {
    flex: 1,
    color: "#e8e8e8",
    fontSize: 15,
    lineHeight: 24,
    padding: 16,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    minHeight: 400,
  },

  toolbar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#2e2e2e",
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  toolbarBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#2a2a2a",
  },
  toolbarBtnText: { fontSize: 12, color: "#888", fontWeight: "600" },
});
