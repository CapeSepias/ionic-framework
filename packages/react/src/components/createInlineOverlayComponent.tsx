import { OverlayEventDetail } from '@ionic/core/components';
import React, { createElement } from 'react';

import {
  attachProps,
  camelToDashCase,
  dashToPascalCase,
  isCoveredByReact,
  mergeRefs,
} from './react-component-lib/utils';
import { createForwardRef } from './utils';

type InlineOverlayState = {
  isOpen: boolean;
};

interface IonicReactInternalProps<ElementType> extends React.HTMLAttributes<ElementType> {
  forwardedRef?: React.ForwardedRef<ElementType>;
  ref?: React.Ref<any>;
  onDidDismiss?: (event: CustomEvent<OverlayEventDetail>) => void;
  onDidPresent?: (event: CustomEvent<OverlayEventDetail>) => void;
  onWillDismiss?: (event: CustomEvent<OverlayEventDetail>) => void;
  onWillPresent?: (event: CustomEvent<OverlayEventDetail>) => void;
  keepContentsMounted?: boolean;
}

export const createInlineOverlayComponent = <PropType, ElementType>(
  tagName: string,
  defineCustomElement?: () => void
) => {
  if (defineCustomElement) {
    defineCustomElement();
  }
  const displayName = dashToPascalCase(tagName);
  const ReactComponent = class extends React.Component<
    IonicReactInternalProps<PropType>,
    InlineOverlayState
  > {
    ref: React.RefObject<HTMLElement>;
    wrapperRef: React.RefObject<HTMLElement>;
    stableMergedRefs: React.RefCallback<HTMLElement>;

    constructor(props: IonicReactInternalProps<PropType>) {
      super(props);
      // Create a local ref to to attach props to the wrapped element.
      this.ref = React.createRef();
      // React refs must be stable (not created inline).
      this.stableMergedRefs = mergeRefs(this.ref, this.props.forwardedRef);
      // Component is hidden by default
      this.state = { isOpen: false };
      // Create a local ref to the inner child element.
      this.wrapperRef = React.createRef();
    }

    componentDidMount() {
      this.componentDidUpdate(this.props);

      /**
       * Mount the inner component
       * when overlay is about to open.
       * Also manually call the onWillPresent
       * handler if present as setState will
       * cause the event handlers to be
       * destroyed and re-created.
       */
      this.ref.current?.addEventListener('willPresent', (evt: any) => {
        this.setState({ isOpen: true });

        this.props.onWillPresent && this.props.onWillPresent(evt);
      });

      /**
       * Unmount the inner component.
       * React will call Node.removeChild
       * which expects the child to be
       * a direct descendent of the parent
       * but due to the presence of
       * Web Component slots, this is not
       * always the case. To work around this
       * we move the inner component to the root
       * of the Web Component so React can
       * cleanup properly.
       */
      this.ref.current?.addEventListener('didDismiss', (evt: any) => {
        const wrapper = this.wrapperRef.current;
        const el = this.ref.current;

        /**
         * This component might be unmounted already, if the containing
         * element was removed while the popover was still open. (For
         * example, if an item contains an inline popover with a button
         * that removes the item.)
         */
        if (wrapper && el) {
          el.append(wrapper);
          this.setState({ isOpen: false });
        }

        this.props.onDidDismiss && this.props.onDidDismiss(evt);
      });
    }

    componentDidUpdate(prevProps: IonicReactInternalProps<PropType>) {
      const node = this.ref.current! as HTMLElement;
      attachProps(node, this.props, prevProps);
    }

    render() {
      const { children, forwardedRef, style, className, ref, ...cProps } = this.props;

      const propsToPass = Object.keys(cProps).reduce((acc, name) => {
        if (name.indexOf('on') === 0 && name[2] === name[2].toUpperCase()) {
          const eventName = name.substring(2).toLowerCase();
          if (isCoveredByReact(eventName)) {
            (acc as any)[name] = (cProps as any)[name];
          }
        } else if (['string', 'boolean', 'number'].includes(typeof (cProps as any)[name])) {
          (acc as any)[camelToDashCase(name)] = (cProps as any)[name];
        }
        return acc;
      }, {});

      const newProps: IonicReactInternalProps<PropType> = {
        ...propsToPass,
        ref: this.stableMergedRefs,
        style,
      };

      return createElement(
        'template',
        {},
        createElement(
          tagName,
          newProps,
          /**
           * We only want the inner component
           * to be mounted if the overlay is open,
           * so conditionally render the component
           * based on the isOpen state.
           */
          this.state.isOpen || this.props.keepContentsMounted
            ? createElement(
                'div',
                {
                  id: 'ion-react-wrapper',
                  ref: this.wrapperRef,
                  className: 'ion-delegate-host',
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                  },
                },
                children
              )
            : null
        )
      );
    }

    static get displayName() {
      return displayName;
    }
  };
  return createForwardRef<PropType, ElementType>(ReactComponent, displayName);
};
