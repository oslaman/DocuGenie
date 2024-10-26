import { Handle } from '@xyflow/react';
import { useHandleConnections } from '@xyflow/react'

const CustomHandle = (props: any) => {
    const connections = useHandleConnections({
        id: props.id,
        type: props.type,
    });
  
    return (
      <Handle
        {...props}
        isConnectable={connections || 0 < props.connectionCount}
      />
    );
  };
  
  export default CustomHandle;