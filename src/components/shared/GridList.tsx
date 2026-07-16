import React from "react";
import { FlatList, FlatListProps } from "react-native";

export default function GridList<T>(props: FlatListProps<T>) {
  return (
    <FlatList
      {...props}
      keyExtractor={(item, index) => String(index)}
      numColumns={props.numColumns || 2}
    />
  );
}
